@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tools\scripts\setup.ps1"
if errorlevel 1 (
  echo.
  echo BP1P setup failed. Press any key to close.
  pause >nul
)
