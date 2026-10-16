using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.DataProtection;

namespace Yunost.Web.Features;

// Все secret keys и refresh tokens остаются на сервере / в зашифрованной HttpOnly-cookie.
public sealed class SupabaseServices
{
    public const string CookieName = "yunost.session";
    readonly IHttpClientFactory clients;
    readonly IDataProtector protector;
    readonly string url, publicKey, secret;
    public bool Configured => url.Length > 0 && publicKey.Length > 0 && secret.Length > 0;
    public SupabaseServices(IHttpClientFactory clients, IDataProtectionProvider protection, IConfiguration cfg, IHostEnvironment env)
    {
        this.clients=clients; protector=protection.CreateProtector("Yunost.Supabase.Session.v1");
        url=(cfg["Supabase:Url"]??"").TrimEnd('/'); publicKey=cfg["Supabase:PublishableKey"]??"";
        secret=cfg["Supabase:SecretKey"]??"";
        var file=cfg["Supabase:SecretKeyFile"];
        if (!string.IsNullOrWhiteSpace(file)) secret=File.ReadAllText(file).Trim();
        if (url.Length>0 && (!Uri.TryCreate(url,UriKind.Absolute,out var uri) ||
           (uri.Scheme!="https" && !(env.IsDevelopment() && uri.IsLoopback && uri.Scheme=="http"))))
            throw new InvalidOperationException("Supabase:Url должен быть HTTPS-адресом проекта.");
    }
    public static CookieOptions Cookie(HttpContext c) => new() { HttpOnly=true, Secure=c.Request.IsHttps, SameSite=SameSiteMode.Strict, Path="/api", MaxAge=TimeSpan.FromDays(5), IsEssential=true };
    void Ensure() { if(!Configured) throw new ApiException(503,"Вход пока не настроен. Подключите Supabase по инструкции в проекте."); }
    HttpRequestMessage Request(HttpMethod method,string path,bool admin=true,string? token=null)
    {
        Ensure(); var req=new HttpRequestMessage(method,url+path);
        var key=admin?secret:publicKey; req.Headers.Add("apikey",key);
        // sb_secret_* / sb_publishable_* НЕ JWT. Bearer используется только для JWT.
        if(token!=null) req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        else if(key.StartsWith("eyJ",StringComparison.Ordinal)) req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",key);
        return req;
    }
    async Task<ApiException> Error(HttpResponseMessage response)
    {

        JsonNode? error=null;
        try{error=JsonNode.Parse(await response.Content.ReadAsStringAsync());}catch(JsonException){}
        var code=error?["code"]?.ToString()??error?["error_code"]?.ToString()??"";
        if (response.StatusCode != HttpStatusCode.OK)
{
    Console.Error.WriteLine(
        $"Supabase HTTP {(int)response.StatusCode}; " +
        $"код ошибки: {code}; " +
        $"сообщение: {error?["message"] ?? error?["msg"] ?? error?["error_description"]}"
    );
}
        if(code.StartsWith("PT") && int.TryParse(code[2..],out var status) && status is >=400 and <=499)
            return new ApiException(status,error?["message"]?.ToString()??"Проверьте данные.");
        return code switch {
            "email_exists" or "user_already_exists" => new(409,"Эта почта уже зарегистрирована. Войдите в аккаунт."),
            "bad_jwt" or "session_not_found" or "refresh_token_not_found" or "refresh_token_already_used" => new(401,"Сессия завершена. Войдите снова."),
            "invalid_credentials" => new(401,"Неверная почта или пароль."),
            "400" when response.StatusCode == HttpStatusCode.BadRequest =>
    new(401, "Неверная электронная почта или пароль."),
            "email_not_confirmed" => new(403,"Подтвердите почту по ссылке из письма Supabase, затем войдите."),
            "weak_password" => new(400,"Выберите более надёжный пароль: не менее 8 символов, буквы и цифры."),
            "over_email_send_rate_limit" or "over_request_rate_limit" => new(429,"Слишком много попыток. Подождите несколько минут."),
            "429" when response.StatusCode == HttpStatusCode.TooManyRequests =>
    new(429, "Supabase временно ограничил отправку писем. Подождите и попробуйте позже."),
            "user_not_found" => new(404,"Аккаунт не найден."),
            _ when response.StatusCode==HttpStatusCode.TooManyRequests => new(429,"Слишком много запросов. Попробуйте немного позже."),
            _ => new(503,"Не удалось выполнить запрос к Supabase. Проверьте подключение и настройку проекта.")
        };
    }
    public async Task<JsonNode> Json(HttpMethod method,string path,object? body=null,bool admin=true,string? token=null)
    {
        using var req=Request(method,path,admin,token);
        if(body!=null) req.Content=JsonContent.Create(body);
        using var res=await clients.CreateClient("supabase").SendAsync(req);
        if(!res.IsSuccessStatusCode) throw await Error(res);
        var text=await res.Content.ReadAsStringAsync();
        return string.IsNullOrEmpty(text)?new JsonObject():JsonNode.Parse(text)??new JsonObject();
    }
    public Task<JsonNode> Rpc(string action,string? actor=null,object? data=null) => Json(HttpMethod.Post,"/rest/v1/rpc/yunost_api",new {p_action=action,p_actor=actor,p_data=data??new {}});
    public Task<JsonNode> Login(string email,string password) => Json(HttpMethod.Post,"/auth/v1/token?grant_type=password",new{email,password},false);

   public async Task<bool> IsEmailConfirmed(string userId)
{
    var user = await Json(
        HttpMethod.Get,
        "/auth/v1/admin/users/" + Input.Id(userId)
    );

    return !string.IsNullOrWhiteSpace(
        user["email_confirmed_at"]?.ToString()
    );
}
    public async Task<JsonNode> Verify(string token)
    {
        try {return await Json(HttpMethod.Get,"/auth/v1/user",admin:false,token:token);}
        catch(ApiException e) when(e.Status is 401 or 404) {throw new ApiException(401,"Войдите в аккаунт ещё раз.");}
    }
    public void SetSession(HttpContext c,JsonNode session)
    {
        var data=new Session(session["access_token"]?.ToString()??"",session["refresh_token"]?.ToString()??"",DateTimeOffset.UtcNow.ToUnixTimeSeconds()+(session["expires_in"]?.GetValue<long>()??3600));
        if(data.AccessToken.Length==0 || data.RefreshToken.Length==0) throw new ApiException(401,"Подтвердите почту и войдите ещё раз.");
        c.Response.Cookies.Append(CookieName,protector.Protect(JsonSerializer.Serialize(data)),Cookie(c));
    }
    public async Task<string?> Uid(HttpContext c,bool optional=false)
    {
        if(c.Items.TryGetValue("supabase.uid",out var known)) return (string?)known;
        if(!c.Request.Cookies.TryGetValue(CookieName,out var cookie)) {
            if(optional)return null; throw new ApiException(401,"Войдите в личный кабинет.");
        }
        try {
            var s=JsonSerializer.Deserialize<Session>(protector.Unprotect(cookie));
            if(s==null)throw new ApiException(401,"Войдите в личный кабинет.");
            if(s.ExpiresAt<DateTimeOffset.UtcNow.ToUnixTimeSeconds()+30) {
                JsonNode renewed;
                try{renewed=await Json(HttpMethod.Post,"/auth/v1/token?grant_type=refresh_token",new{refresh_token=s.RefreshToken},false);}
                catch(ApiException e) when(e.Status!=503 && e.Status!=429){throw new ApiException(401,"Сессия завершена. Войдите снова.");}
                SetSession(c,renewed); s=s with{AccessToken=renewed["access_token"]!.ToString()};
            }
            var user=await Verify(s.AccessToken);
            var id=user["id"]?.ToString();
            if(!Guid.TryParse(id,out _))throw new ApiException(401,"Войдите в личный кабинет.");
            c.Items["supabase.uid"]=id; c.Items["supabase.token"]=s.AccessToken; return id;
        } catch(Exception e) when(e is System.Security.Cryptography.CryptographicException or JsonException || e is ApiException {Status:401 or 404}) {
            c.Response.Cookies.Delete(CookieName,Cookie(c));
            if(optional) return null;
            throw new ApiException(401,"Сессия завершена. Войдите снова.");
        }
    }
    public async Task Logout(HttpContext c)
    {
        try {await Uid(c,true); if(c.Items["supabase.token"] is string token) await Json(HttpMethod.Post,"/auth/v1/logout?scope=local",admin:false,token:token);}
        finally {c.Response.Cookies.Delete(CookieName,Cookie(c));}
    }
    public async Task DeleteAuthUser(string uid)
    {
        try{await Json(HttpMethod.Delete,"/auth/v1/admin/users/"+Input.Id(uid),new{should_soft_delete=false});}
        catch(ApiException e) when(e.Status==404){}
    }
    public async Task Upload(string path,byte[] bytes,string type)
    {
        using var req=Request(HttpMethod.Post,"/storage/v1/object/yunost-media/"+path);
        req.Headers.Add("x-upsert","true"); req.Content=new ByteArrayContent(bytes); req.Content.Headers.ContentType=new MediaTypeHeaderValue(type);
        using var res=await clients.CreateClient("supabase").SendAsync(req);
        if(!res.IsSuccessStatusCode) throw await Error(res);
    }
    public async Task<byte[]> Download(string path)
    {
        using var req=Request(HttpMethod.Get,"/storage/v1/object/authenticated/yunost-media/"+path);
        using var res=await clients.CreateClient("supabase").SendAsync(req);
        if(res.StatusCode==HttpStatusCode.NotFound)throw new ApiException(404,"Файл не найден. Выполните первоначальную загрузку изображений.");
        if(!res.IsSuccessStatusCode)throw await Error(res);
        return await res.Content.ReadAsByteArrayAsync();
    }
    public Task<JsonNode> Remove(string path) => Json(HttpMethod.Delete,"/storage/v1/object/yunost-media",new{prefixes=new[]{path}});
    record Session(string AccessToken,string RefreshToken,long ExpiresAt);
}
