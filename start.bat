@echo off
title SUNBII WORLD - Local Server
cd /d "%~dp0"
echo.
echo   ==========================================
echo    SUNBII WORLD dang khoi dong...
echo    Khong dong cua nay khi dang choi!
echo   ==========================================
echo.
start "" "http://localhost:8787/"
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8787
) else (
  py -m http.server 8787
)
pause
