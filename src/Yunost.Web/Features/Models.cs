using System.Globalization;
using System.Net.Mail;
using System.Text.RegularExpressions;
namespace Yunost.Web.Features;
public sealed class ApiException(int status,string message) : Exception(message) { public int Status {get;}=status; }
public static class Input
{
    public static string Id(string value) => Guid.TryParse(value,out var id) ? id.ToString() : throw new ApiException(400,"Некорректный идентификатор.");
    public static string Text(string? value, string name, int min, int max)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < min) throw new ApiException(400, $"Заполните поле «{name}» (не менее {min} символов).");
        if (text.Length > max) throw new ApiException(400, $"Поле «{name}» должно содержать не более {max} символов.");
        return text;
    }
    public static string Email(string? value)
    {
        var email = Text(value, "Электронная почта", 3, 254).ToLowerInvariant();
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !email.Contains('.'))
            throw new ApiException(400, "Введите электронную почту в формате name@example.com.");
        return email;
    }
    public static string Phone(string? value)
    {
        var phone = Text(value, "Телефон", 10, 30);
        var digits = phone.Count(char.IsAsciiDigit);
        if (!Regex.IsMatch(phone, @"^[+0-9() .-]+$") || digits is < 10 or > 15)
            throw new ApiException(400, "Введите телефон: от 10 до 15 цифр, можно с кодом страны.");
        return phone;
    }
    public static string BirthDate(string? value)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            || date < new DateOnly(1990, 1, 1) || date > today)
            throw new ApiException(400, "Выберите настоящую дату рождения: с 1990 года по сегодняшний день.");
        return date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
    public static void Password(string? password, string? confirm)
    {
        if (password is null || password.Length is < 8 or > 128)
            throw new ApiException(400, "Пароль должен содержать от 8 до 128 символов.");
        if (password != confirm) throw new ApiException(400, "Пароли не совпадают.");
    }
}

public static class Payload
{
    public static string Text(System.Text.Json.Nodes.JsonObject d,string key,string label,int min,int max) => Input.Text(d[key]?.ToString(),label,min,max);
    public static object Profile(System.Text.Json.Nodes.JsonObject d) => new {fullName=Text(d,"fullName","ФИО",5,140),phone=Input.Phone(d["phone"]?.ToString()),about=Text(d,"about","О себе",1,2000),experience=Text(d,"experience","Опыт",0,2000)};
    public static void Validate(string action,System.Text.Json.Nodes.JsonObject d)
    {
        if(action=="post_save") {
            d["title"]=Text(d,"title","Заголовок",3,180); d["body"]=Text(d,"body","Текст",1,12000);
            foreach(var (key,allowed) in new[]{("type",new[]{"news","event"}),("state",new[]{"draft","published"}),("audience",new[]{"public","team"})})
                if(!allowed.Contains(d[key]?.ToString()))throw new ApiException(400,"Выберите тип, видимость и состояние публикации.");
            foreach(var key in new[]{"publishAt","expiresAt"}.Concat(d["type"]?.ToString()=="event"?new[]{"startsAt","endsAt"}:[])) {
                if(!DateTimeOffset.TryParse(d[key]?.ToString(),CultureInfo.InvariantCulture,DateTimeStyles.None,out var t) || t.Year is <2000 or >2100)throw new ApiException(400,"Укажите корректные дату и время.");
                d[key]=t.ToUniversalTime().ToString("O");
            }
            if(d["type"]?.ToString()=="event") d["place"]=Text(d,"place","Место проведения",1,300);
        }
        if(action=="product_save") {
            d["title"]=Text(d,"title","Название",2,120);d["tag"]=Text(d,"tag","Описание",0,200);d["category"]=Text(d,"category","Категория",1,80);
            if(!Regex.IsMatch(d["id"]?.ToString()??"","^[a-z0-9-]{1,50}$"))throw new ApiException(400,"Некорректный идентификатор вещи.");
        }
    }
}
