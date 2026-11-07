@echo off
cd /d "%~dp0"
start "Curl Studio" http://127.0.0.1:3210
node server.cjs
pause
