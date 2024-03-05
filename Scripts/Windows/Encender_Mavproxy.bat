@echo off
start mavproxy.exe
timeout /t 22 /nobreak
taskkill /f /im mavproxy.exe
exit