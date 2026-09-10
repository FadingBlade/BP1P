@echo off
setlocal
cd /d "%~dp0"
:menu
cls
echo ========================================
echo          BP1P Production Manager
echo ========================================
echo.
echo  1. First-time setup
echo  2. Start / rebuild BP1P
echo  3. Open Node Console (applications)
echo  4. Open Directory Console (node trust)
echo  5. Open BP1P client
echo  6. Update / rebuild nodes
echo  7. Pair client to a public directory
echo  8. View live Docker logs
echo  9. Stop BP1P
echo  0. Exit
echo.
set /p pick=Choose: 
if "%pick%"=="1" call SETUP-BP1P.cmd
if "%pick%"=="2" call START-BP1P.cmd
if "%pick%"=="3" call OPEN-NODE-CONSOLE.cmd
if "%pick%"=="4" call OPEN-DIRECTORY-CONSOLE.cmd
if "%pick%"=="5" start "" "%~dp0BP1P.html"
if "%pick%"=="6" call UPDATE-BP1P.cmd
if "%pick%"=="7" call PAIR-CLIENT.cmd
if "%pick%"=="8" call LOGS-BP1P.cmd
if "%pick%"=="9" call STOP-BP1P.cmd
if "%pick%"=="0" exit /b 0
goto menu
