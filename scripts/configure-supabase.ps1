$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$url = (Read-Host 'Project URL из Supabase (https://...supabase.co)').Trim().TrimEnd('/')
$publishable = (Read-Host 'Publishable key (sb_publishable_...)').Trim()
$secure = Read-Host 'Secret key (sb_secret_...), ввод скрыт' -AsSecureString
$secret = [System.Net.NetworkCredential]::new('', $secure).Password
if (-not $url.StartsWith('https://') -or $publishable.Length -lt 20 -or $secret.Length -lt 20) { throw 'Проверь URL и ключи.' }
@{'Supabase:Url'=$url; 'Supabase:PublishableKey'=$publishable; 'Supabase:SecretKey'=$secret} | ConvertTo-Json | dotnet user-secrets set --project src/Yunost.Web
$secret = $null
if ($LASTEXITCODE -ne 0) { throw 'Не удалось сохранить настройки.' }
Write-Host 'Настройки сохранены на этом компьютере. Далее загрузи изображения и создай владельца по инструкции.'
