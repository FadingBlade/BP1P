@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\pair-client.ps1"
pause
