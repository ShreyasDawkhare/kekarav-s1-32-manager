@echo off
title Kekarav S1-32 Manager - Restart
echo ========================================
echo   Restarting Kekarav S1-32 Manager...
echo ========================================
echo.

set RESTART_MODE=1
call stop.bat
set RESTART_MODE=
echo.
call start.bat

