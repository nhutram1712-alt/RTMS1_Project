@echo off
chcp 65001 >nul
title RTMS - Dong Server
echo ======================================================
echo    DANG TAT HE THONG RTMS TRUOC KHI TAT MAY...
echo ======================================================
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo.
echo Da tat sach se moi tien trinh Web RTMS!
echo Ban co the an tam dong/tat may tinh.
timeout /t 3 >nul
