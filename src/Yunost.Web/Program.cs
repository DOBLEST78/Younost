using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Yunost.Web.Features;

var command=args.FirstOrDefault() is "--setup-owner" or "--seed-assets";
var builder=WebApplication.CreateBuilder(command?[]:args);
builder.WebHost.ConfigureKestrel(o=>o.Limits.MaxRequestBodySize=65536);
builder.Logging.AddFilter("System.Net.Http.HttpClient",LogLevel.Warning);
builder.Services.Configure<ForwardedHeadersOptions>(o=>{
    o.ForwardedHeaders=ForwardedHeaders.XForwardedFor|ForwardedHeaders.XForwardedProto;o.ForwardLimit=1;
    o.KnownIPNetworks.Clear();o.KnownProxies.Clear();
    foreach(var ip in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>()??[])o.KnownProxies.Add(IPAddress.Parse(ip));
    if(o.KnownProxies.Count==0)o.KnownProxies.Add(IPAddress.Loopback);
});
var keyPath=builder.Configuration["DataProtection:Path"]??Path.Combine(builder.Environment.ContentRootPath,"data","keys");
Directory.CreateDirectory(keyPath);
builder.Services.AddDataProtection().SetApplicationName("Yunost").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
builder.Services.AddHttpClient("supabase", client =>
{
    client.Timeout = TimeSpan.FromSeconds(25);
    client.DefaultRequestVersion = HttpVersion.Version11;
    client.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact;
})
.ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(2),
    PooledConnectionIdleTimeout = TimeSpan.FromSeconds(15),
    MaxConnectionsPerServer = 10
});
builder.Services.AddSingleton<SupabaseServices>();builder.Services.AddSingleton<MediaStore>();builder.Services.AddSingleton<Maintenance>();
builder.Services.AddSingleton<RegistrationTracker>();
builder.Services.AddHostedService(sp=>sp.GetRequiredService<Maintenance>());
builder.Services.AddRateLimiter(o=>{
    foreach(var name in new[]{"auth","uploads"})o.AddPolicy(name,c=>RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions{PermitLimit=name=="auth"?20:30,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.OnRejected=async(c,t)=>{c.HttpContext.Response.StatusCode=429;await c.HttpContext.Response.WriteAsJsonAsync(new{detail="Слишком много запросов. Подождите минуту."},t);};
});
var app=builder.Build();
if(command){
    try{if(args[0]=="--setup-owner")await OwnerSetup.Run(app.Services.GetRequiredService<SupabaseServices>());else await app.Services.GetRequiredService<MediaStore>().Seed();}
    catch(ApiException e){Console.Error.WriteLine(e.Message);Environment.ExitCode=1;}
    return;
}
app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment()) app.UseHsts();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; " +
        "script-src 'self'; font-src 'self'; connect-src 'self'; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/assets/images") || context.Request.Path.StartsWithSegments("/assets/models"))
    {
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            // Нестандартный заголовок + Origin, без CORS: чужой сайт не может
            // отправить запрос с cookie через обычную форму или cross-origin fetch.
            if (context.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
            {
                var origin = context.Request.Headers.Origin.ToString();
                var expected = $"{context.Request.Scheme}://{context.Request.Host}";
                if (context.Request.Headers["X-Yunost-Request"] != "1" ||
                    (origin.Length > 0 && !string.Equals(origin, expected, StringComparison.OrdinalIgnoreCase)) ||
                    context.Request.Headers["Sec-Fetch-Site"] == "cross-site")
                    throw new ApiException(403, "Запрос отклонён. Обновите страницу и повторите действие.");
                if (!app.Environment.IsDevelopment() && !context.Request.IsHttps)
                    throw new ApiException(400, "Для входа и изменения данных откройте сайт по HTTPS.");
            }
            await next();
        }
        catch (ApiException exception)
        {
            context.Response.StatusCode = exception.Status;
            await context.Response.WriteAsJsonAsync(new { detail = exception.Message });
        }
        catch (BadHttpRequestException)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { detail = "Не удалось прочитать данные формы. Проверьте поля и повторите отправку." });
        }
        catch (Exception exception)
        {
           app.Logger.LogError(exception, "Ошибка при выполнении запроса к Supabase");
            context.Response.StatusCode = 503;
            await context.Response.WriteAsJsonAsync(new { detail = "Сервис временно недоступен. Попробуйте позже. Если это первый запуск, проверьте подключение Supabase." });
        }
        return;
    }
    await next();
});

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
    }

    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();

app.MapApi();
app.MapGet("/assets/images/{file}",(string file,HttpContext c,MediaStore m)=>m.Asset("images",file,c));
app.MapGet("/assets/models/{file}",(string file,HttpContext c,MediaStore m)=>m.Asset("models",file,c));
app.Map("/api/{**path}",()=>Results.NotFound(new{detail="Такого действия на сервере нет."}));
app.Run();
