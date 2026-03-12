@echo off
echo Stopping Kekarav S1-32 Manager on port 132...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :132 ^| findstr LISTENING') do (
    echo Found process %%a
    taskkill /F /PID %%a >nul 2>&1
    echo Server stopped.
    goto :done
)
echo No server found running on port 132.
:done
if "%~1"=="" if not defined RESTART_MODE pause

