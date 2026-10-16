namespace Yunost.Web.Features;
public static class OwnerSetup
{
    public static async Task Run(SupabaseServices s)
    {
        await s.Rpc("ready");
        Console.Write("Твоя электронная почта: ");var email=Input.Email(Console.ReadLine());
        Console.Write("Пароль (не отображается): ");var password=ReadPassword();Input.Password(password,password);
        var exists=(await s.Rpc("email_exists",data:new{email}))["exists"]!.GetValue<bool>();
        string uid;
        if(exists) {var session=await s.Login(email,password);uid=session["user"]!["id"]!.ToString();}
        else {var created=await s.Json(HttpMethod.Post,"/auth/v1/admin/users",new{email,password,email_confirm=true,user_metadata=new{full_name="Гущина Алина Артемовна"}});uid=(created["user"]??created)["id"]!.ToString();}
        await s.Rpc("owner_setup",data:new{id=uid,email,fullName="Гущина Алина Артемовна"});
        Console.WriteLine("Твой аккаунт владельца готов. Войди на сайте с этой почтой и паролем.");
    }
    static string ReadPassword()
    {
        if(Console.IsInputRedirected)throw new ApiException(400,"Запусти команду в обычном терминале: пароль вводится скрыто.");
        var text=new System.Text.StringBuilder();ConsoleKeyInfo key;
        while((key=Console.ReadKey(true)).Key!=ConsoleKey.Enter){if(key.Key==ConsoleKey.Backspace){if(text.Length>0)text.Length--;}else if(!char.IsControl(key.KeyChar))text.Append(key.KeyChar);}
        Console.WriteLine();return text.ToString();
    }
}
