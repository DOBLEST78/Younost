namespace Yunost.Web.Features;
public sealed class MediaStore(SupabaseServices s,IHostEnvironment env)
{
    public const long MaxBytes=5*1024*1024;
    public async Task<object> Upload(string uid,HttpRequest request)
    {
        if(request.ContentLength is null or <=0 or >MaxBytes)throw new ApiException(400,"Выберите изображение размером до 5 МБ.");
        using var ms=new MemoryStream();var buffer=new byte[65536];int read;
        while((read=await request.Body.ReadAsync(buffer))>0){if(ms.Length+read>MaxBytes)throw new ApiException(400,"Изображение больше 5 МБ.");await ms.WriteAsync(buffer.AsMemory(0,read));}
        var bytes=ms.ToArray();var type=Detect(bytes);var id=Guid.NewGuid().ToString();
        await s.Rpc("media_reserve",uid,new{id,contentType=type,bytes=bytes.Length});
        await s.Upload("uploads/"+id,bytes,type);await s.Rpc("media_ready",data:new{id});
        return new{id,url="/api/media/"+id};
    }
    static string Detect(byte[] b)
    {
        if(b.Length>=24 && b.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10})){
            var w=System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(16,4));var h=System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(20,4));
            if(w is 0 or >10000 || h is 0 or >10000 || (long)w*h>40000000)throw new ApiException(400,"Слишком большое разрешение фотографии.");return "image/png";
        }
        if(b.Length>16 && b[0]==255 && b[1]==216 && b[2]==255 && b[^2]==255 && b[^1]==217)return "image/jpeg";
        if(b.Length>20 && System.Text.Encoding.ASCII.GetString(b,0,4)=="RIFF" && System.Text.Encoding.ASCII.GetString(b,8,4)=="WEBP")return "image/webp";
        throw new ApiException(400,"Поддерживаются фотографии PNG, JPEG и WebP.");
    }
    public async Task Seed()
    {
        await s.Rpc("ready");
        foreach(var dir in new[]{"images","models"}){
            var root=Path.Combine(env.ContentRootPath,"SeedAssets",dir);
            foreach(var path in Directory.EnumerateFiles(root).Where(p=>Type(p)!=null)){
                await s.Upload((dir=="images"?"site/":"models/")+Path.GetFileName(path),await File.ReadAllBytesAsync(path),Type(path)!);
                Console.WriteLine("Загружено: "+Path.GetFileName(path));
            }
        }
    }
    public async Task<IResult> Asset(string dir,string file,HttpContext c)
    {
        // Только файлы, включённые в дистрибутив: запрет чтения произвольных путей в bucket.
        if(file!=Path.GetFileName(file) || Type(file)==null)throw new ApiException(404,"Файл не найден.");
        var path=Path.Combine(env.ContentRootPath,"SeedAssets",dir,file);
        if(!File.Exists(path))throw new ApiException(404,"Файл не найден.");
        c.Response.Headers.CacheControl="public,max-age=3600";
        // Локальный просмотр до настройки. После подключения читаем исключительно Storage.
        var bytes=s.Configured?await s.Download((dir=="images"?"site/":"models/")+file):await File.ReadAllBytesAsync(path);
        return Results.File(bytes,Type(file)!);
    }
    static string? Type(string path)=>Path.GetExtension(path).ToLowerInvariant()switch{".webp"=>"image/webp",".png"=>"image/png",".jpg"=>"image/jpeg",".glb"=>"model/gltf-binary",_=>null};
}
public sealed class Maintenance(SupabaseServices s,ILogger<Maintenance> logger):BackgroundService
{
    readonly SemaphoreSlim gate=new(1);
    public async Task DeleteUser(string id){await s.DeleteAuthUser(id);await s.Rpc("delete_done",data:new{id});}
    public async Task Run()
    {
        if(!s.Configured || !await gate.WaitAsync(0))return;
        try{
            foreach(var job in (await s.Rpc("jobs")).AsArray())await DeleteUser(job!.ToString());
            await s.Rpc("sweep");
            foreach(var media in (await s.Rpc("media_claim")).AsArray()){
                var id=media!.ToString();await s.Remove("uploads/"+id);await s.Rpc("media_forget",data:new{id});
            }
        } finally{gate.Release();}
    }
    protected override async Task ExecuteAsync(CancellationToken token)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromMinutes(1));
        while(!token.IsCancellationRequested){
            try{await Run();}catch(Exception){logger.LogWarning("Фоновая очистка Supabase не завершена. Повтор через минуту.");}
            try{if(!await timer.WaitForNextTickAsync(token))break;}catch(OperationCanceledException){break;}
        }
    }
}
