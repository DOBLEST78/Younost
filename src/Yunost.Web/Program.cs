// Первый этап: ASP.NET Core раздаёт интерфейс. Бизнес-операции будут
// реализованы через серверные API и SQL Server на следующем этапе.
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; " +
        "script-src 'self'; font-src 'self'; connect-src 'self'; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    stage = "frontend",
    databaseConnected = false,
    accountsEnabled = false
}));

// Не возвращаем фиктивный успех для входа, покупки или заявки.
// Маршруты появятся здесь при подключении SQL Server.
app.Map("/api/{**path}", (HttpContext context) =>
    Results.Problem(
        statusCode: StatusCodes.Status503ServiceUnavailable,
        title: "Сервис пока недоступен",
        detail: "Личный кабинет и отправка заявок ещё не подключены. " +
                "Свяжитесь с отрядом в Telegram."
    ));

app.Run();
