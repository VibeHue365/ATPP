@echo off
title VibeHue Mobile Launcher
echo ========================================================
echo       DANG KHOI DONG MAY AO ANDROID PIXEL 6...
echo ========================================================
start "" "D:\jdk\emulator\emulator.exe" -avd Pixel_6_API_34

echo Cho may ao khoi dong trong giay lat...
timeout /t 6 /nobreak >nul

echo ========================================================
echo       DANG KHOI DONG METRO VA MO APP VIBEHUE...
echo ========================================================
cd /d "d:\VibeHue\mobile"
call npm run android
pause
