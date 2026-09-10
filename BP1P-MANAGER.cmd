@echo off
setlocal
cd /d "%~dp0"
:menu
cls
echo ========================================
echo             BP1P Manager 1.0
echo ========================================
echo.
echo  1. FIRST SETUP       - build everything and open it
echo  2. START / REBUILD   - start the local BP1P host
echo  3. MANAGE WEBSITES   - open Node Console
echo  4. MANAGE NODES      - open Directory Console
echo  5. OPEN CLIENT       - double-clickable BP1P HTML client
echo  6. UPDATE            - rebuild from current release files
echo  7. PAIR PUBLIC CLIENT- pair client to a public directory
echo  8. LOGS              - live Docker logs
echo  9. STOP
echo  0. EXIT
echo.
set /p pick=Choose: 
if "%pick%"=="1" call Tools\SETUP.cmd
if "%pick%"=="2" call Tools\START.cmd
if "%pick%"=="3" call Tools\OPEN-NODE-CONSOLE.cmd
if "%pick%"=="4" call Tools\OPEN-DIRECTORY-CONSOLE.cmd
if "%pick%"=="5" call Tools\OPEN-CLIENT.cmd
if "%pick%"=="6" call Tools\UPDATE.cmd
if "%pick%"=="7" call Tools\PAIR-CLIENT.cmd
if "%pick%"=="8" call Tools\LOGS.cmd
if "%pick%"=="9" call Tools\STOP.cmd
if "%pick%"=="0" exit /b 0
goto menu
