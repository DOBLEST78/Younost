@echo off
setlocal
cd /d "%~dp0"
where dotnet >nul 2>nul
if errorlevel 1 (
  echo Install the .NET 10 SDK first:
  echo https://dotnet.microsoft.com/download/dotnet/10.0
  echo Choose SDK for Windows, then open this file again.
  pause
  exit /b 1
)
dotnet --list-sdks | findstr /b "10." >nul
if errorlevel 1 (
  echo The .NET 10 SDK is required for this project.
  echo https://dotnet.microsoft.com/download/dotnet/10.0
  pause
  exit /b 1
)
echo Starting Yunost at http://localhost:5080
echo Keep this window open. Press Ctrl+C to stop.
dotnet run --project src\Yunost.Web
pause
