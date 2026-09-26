@echo off
setlocal
cd /d "%~dp0"

if not exist "new-api.exe" (
  echo [ERROR] new-api.exe not found in %CD%
  echo Build it first:  go build -o new-api.exe .
  pause
  exit /b 1
)

echo Starting New API from %CD%
start "" /min new-api.exe

echo.
echo New API is starting up. Open http://localhost:3000 in your browser.
echo The server window is minimized - closing it will stop the service.
echo.
timeout /t 3 >nul
