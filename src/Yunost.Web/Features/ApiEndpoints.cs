using System.Text.Json;
using System.Text.Json.Nodes;
namespace Yunost.Web.Features;

public static class ApiEndpoints
{
    static async Task<JsonObject> Body(HttpContext c) => await c.Request.ReadFromJsonAsync<JsonObject>() ?? throw new ApiException(400,"Заполните поля формы.");

    static JsonNode? VisibleProfile(JsonNode? profile)
{
    if (profile == null)
        return null;

    if (profile["membershipStatus"]?.ToString() == "accepted")
        return profile;

    return new JsonObject
    {
        ["membershipStatus"] = profile["membershipStatus"]?.ToString() ?? "pending",
        ["role"] = "candidate",
        ["canManage"] = false
    };
}
    public static void MapApi(this WebApplication app)
    {
        app.MapGet("/api/health", (SupabaseServices s)=>Results.Ok(new{status="ok",stage="supabase",accountsEnabled=s.Configured}));
        app.MapGet("/api/me", async(HttpContext c,SupabaseServices s)=>{
            var id=await s.Uid(c,true);JsonNode? user=null;
            if(id!=null)try{user=await s.Rpc("profile",id);}catch(ApiException e)when(e.Status==401){c.Response.Cookies.Delete(SupabaseServices.CookieName,SupabaseServices.Cookie(c));}
            return Results.Ok(new
{
    user = VisibleProfile(user),
    accountsEnabled = s.Configured
});
        });
        app.MapPost("/api/auth/login",async(HttpContext c,SupabaseServices s)=>{
            var d=await Body(c);var email=Input.Email(d["email"]?.ToString());var password=Payload.Text(d,"password","Пароль",1,128);
            var session=await s.Login(email,password);var user=await s.Rpc("profile",session["user"]!["id"]!.ToString());
            s.SetSession(c, session);
return Results.Ok(new { user = VisibleProfile(user) });
        }).RequireRateLimiting("auth");
        app.MapPost("/api/membership-applications",async(
    HttpContext c,
    SupabaseServices s,
    RegistrationTracker tracker) =>
{
            var d=await Body(c);var profile=JsonSerializer.SerializeToNode(Payload.Profile(d))!.AsObject();
            profile["email"]=Input.Email(d["email"]?.ToString());profile["birthDate"]=Input.BirthDate(d["birthDate"]?.ToString());
            var password=d["password"]?.ToString();Input.Password(password,d["confirmPassword"]?.ToString());
            if((await s.Rpc("email_exists",data:new{email=profile["email"]!.ToString()}))["exists"]!.GetValue<bool>())throw new ApiException(409,"Эта почта уже зарегистрирована. Войдите в аккаунт.");
            var session=await s.Json(HttpMethod.Post,"/auth/v1/signup",new{email=profile["email"]!.ToString(),password,data=new{yunost_profile=profile}},false);
            // При включённом подтверждении Supabase возвращает User, без сессии.
            var authUser=session["user"]??session;var uid=authUser["id"]?.ToString();
            if(uid==null)throw new ApiException(409,"Не удалось создать аккаунт. Проверьте почту или попробуйте войти.");
            JsonNode user;
            try{user=await s.Rpc("profile",uid);}
            catch(ApiException e)when(e.Status==401){throw new ApiException(409,"Эта почта уже зарегистрирована. Войдите в аккаунт.");}
           var confirmationRequired = session["access_token"] == null;

if (!confirmationRequired)
{
    throw new ApiException(
        409,
        "Регистрация требует подтверждения электронной почты. Проверьте настройки Supabase."
    );
}

var registrationTicket = tracker.Create(uid);

return Results.Ok(new
{
    user = (JsonNode?)null,
    confirmationRequired = true,
    registrationTicket
});
        }).RequireRateLimiting("auth");
        app.MapPost("/api/auth/registration-status", async (
    HttpContext c,
    SupabaseServices s,
    RegistrationTracker tracker) =>
{
    var data = await Body(c);
    var ticket = data["registrationTicket"]?.ToString();

    if (string.IsNullOrWhiteSpace(ticket))
        throw new ApiException(400, "Отсутствует идентификатор регистрации.");

    var userId = tracker.GetUserId(ticket);

    if (userId == null)
        throw new ApiException(410, "Время ожидания истекло. Обновите страницу.");

    var confirmed = await s.IsEmailConfirmed(userId);

    return Results.Ok(new
    {
        confirmed
    });
}).RequireRateLimiting("auth");
        // Повторная отправка подтверждения электронной почты
        app.MapPost("/api/auth/resend", async (HttpContext c, SupabaseServices s) =>
        {
            var data = await Body(c);
            var email = Input.Email(data["email"]?.ToString());

            await s.Json(
                HttpMethod.Post,
                "/auth/v1/resend",
                new
                {
                    type = "signup",
                    email = email
                },
                admin: false
            );

            return Results.Ok(new
            {
                success = true,
                message = "Если адрес ожидает подтверждения, письмо будет отправлено повторно. Проверьте входящие и папку «Спам»."
            });
        }).RequireRateLimiting("auth");


        app.MapPost("/api/auth/confirm",async(HttpContext c,SupabaseServices s)=>{
            var d=await Body(c);var token=Payload.Text(d,"accessToken","Подтверждение",10,8000);
            var auth=await s.Verify(token);var user=await s.Rpc("profile",auth["id"]!.ToString());
            // Проверяем refresh token независимо, чтобы не записать чужую пару токенов.
            var session=await s.Json(HttpMethod.Post,"/auth/v1/token?grant_type=refresh_token",new{refresh_token=Payload.Text(d,"refreshToken","Подтверждение",5,4000)},false);
            if(session["user"]?["id"]?.ToString()!=auth["id"]!.ToString())throw new ApiException(401,"Подтверждение не удалось. Войдите заново.");
            s.SetSession(c, session);
return Results.Ok(new { user = VisibleProfile(user) });
        }).RequireRateLimiting("auth");
        app.MapPost("/api/auth/logout",async(HttpContext c,SupabaseServices s)=>{await s.Logout(c);return Results.Ok(new{success=true});});
       app.MapPatch("/api/me", async (HttpContext c, SupabaseServices s) =>
{
    var id = await s.Uid(c);
    var profile = await s.Rpc("profile", id);

    if (profile["membershipStatus"]?.ToString() != "accepted")
    {
        throw new ApiException(
            403,
            "Редактирование профиля станет доступно после принятия в отряд."
        );
    }

    var data = Payload.Profile(await Body(c));
    var updatedUser = await s.Rpc("profile_update", id, data);

    return Results.Ok(new { user = updatedUser });
});

        // В этой таблице — только явно разрешённые операции. p_actor берётся из проверенной сессии.
        var routes=new(string Method,string Path,string Action,bool Public,bool User)[]{
            ("GET","/manage/applications","applications",false,false),
            ("POST","/manage/applications/{id}/decision","review",false,false),
            ("GET","/manage/team","team",false,false),("PATCH","/manage/team/{id}/role","role",false,false),
            ("GET","/manage/members","members",false,false),("GET","/manage/members/{id}/deletion","delete_status",false,false),
            ("GET","/posts","posts",true,false),("GET","/posts/{id}","post",true,false),
            ("GET","/manage/posts","posts",false,false),("GET","/manage/posts/{id}","post",false,false),
            ("PUT","/manage/posts/{id}","post_save",false,false),("DELETE","/manage/posts/{id}","post_delete",false,false),
            ("GET","/manage/cleanup","cleanup_settings",false,false),("PUT","/manage/cleanup","cleanup_set",false,false),
            ("GET","/events/{id}/registration","registration",false,false),("POST","/events/{id}/registration","event_register",false,true),
            ("DELETE","/events/{id}/registration","event_cancel",false,true),("GET","/me/events","my_events",false,false),
            ("GET","/manage/events","events",false,false),("GET","/manage/events/{id}/participants","participants",false,false),
            ("POST","/manage/events/{id}/participants/{userId}","attendance",false,false),
            ("GET","/me/transactions","transactions",false,false),("GET","/me/achievements","achievements",false,false),("GET","/leaderboard","leaderboard",false,false),
            ("GET","/shop/products","products",false,false),("GET","/manage/products","products",false,false),
            ("PUT","/manage/products/{id}","product_save",false,false),("DELETE","/manage/products/{id}","product_delete",false,false),
            ("POST","/shop/{id}/purchase","purchase",false,true),("PUT","/me/wardrobe","equip",false,true)
        };
        foreach(var route in routes)app.MapMethods("/api"+route.Path,[route.Method],async(HttpContext c,SupabaseServices s)=>{
            var actor = await s.Uid(c, route.Public);

// Закрытые функции доступны только принятым участникам.
if (!route.Public && actor != null)
{
    var profile = await s.Rpc("profile", actor);
    var status = profile["membershipStatus"]?.ToString();

    if (status != "accepted")
    {
        throw new ApiException(
            403,
            "Доступ к личному кабинету откроется после принятия в отряд."
        );
    }
}

var d = c.Request.ContentLength > 0
    ? await Body(c)
    : new JsonObject();
            // Не доверяем присланным manage/id/userId: значения определяет маршрут.
            foreach(var key in new[]{"cursor","email","status"})if(c.Request.Query.TryGetValue(key,out var value))d[key]=value.ToString();
            foreach(var key in new[]{"id","userId"})if(c.Request.RouteValues.TryGetValue(key,out var value))d[key]=value?.ToString();
            d["manage"]=route.Path.StartsWith("/manage");
            Payload.Validate(route.Action,d);
            var result=await s.Rpc(route.Action,actor,d);
            return route.User?Results.Ok(new{user=result}):Results.Ok(result);
        });
        app.MapDelete("/api/manage/members/{id}",async(string id,HttpContext c,SupabaseServices s,Maintenance jobs)=>{
            id=Input.Id(id);var requested=await s.Rpc("delete_request",await s.Uid(c),new{id});
            if(requested["queued"]?.GetValue<bool>()!=true)return Results.Ok(new{success=true,pending=false});
            try{await jobs.DeleteUser(id);return Results.Ok(new{success=true,pending=false});}
            catch(Exception){return Results.Json(new{pending=true,detail="Доступ закрыт. Сервер продолжит полное удаление."},statusCode:202);}
        });
        app.MapPost("/api/manage/cleanup/run",async(HttpContext c,SupabaseServices s,Maintenance jobs)=>{
            await s.Rpc("sweep",await s.Uid(c));await jobs.Run();return Results.Ok(new{success=true});
        });
        app.MapPost("/api/manage/media",async(HttpContext c,SupabaseServices s,MediaStore media)=>{
            var limit=c.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if(limit is {IsReadOnly:false})limit.MaxRequestBodySize=MediaStore.MaxBytes;
            return Results.Ok(await media.Upload((await s.Uid(c))!,c.Request));
        }).RequireRateLimiting("uploads");
        app.MapGet("/api/media/{id}",async(string id,HttpContext c,SupabaseServices s)=>{
            id=Input.Id(id);var meta=await s.Rpc("media_read",await s.Uid(c,true),new{id});
            return Results.File(await s.Download("uploads/"+id),meta["contentType"]!.ToString());
        });
    }
}
