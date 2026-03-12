@echo off
title Kekarav S1-32 Manager
echo ========================================
echo   Starting Kekarav S1-32 Manager...
echo   Close this window to stop the server
echo ========================================
echo.
echo Installing dependencies...
call npm install --production 2>nul
echo.
node server.js
echo.
echo Server stopped.
pause

