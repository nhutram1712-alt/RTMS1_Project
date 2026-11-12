@echo off
chcp 65001 >nul
title RTMS - He Thong Quan Ly Nha Tro
echo ======================================================
echo    DANG KHOI DONG HE THONG RTMS (BACKEND + FRONTEND)
echo ======================================================
echo.
cd /d "%~dp0rtms-backend"
echo [1/2] Dang mo trinh duyet tai http://localhost:5000 ...
start "" "http://localhost:5000"
echo [2/2] Dang chay Server Node.js tren Port 5000 ...
echo.
echo ======================================================
echo   WEB DANG CHAY TAI: http://localhost:5000
echo   (Nhan Ctrl + C de tat server truoc khi dong may)
echo ======================================================
echo.
node dist/server.js
pause
