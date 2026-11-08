@echo off
setlocal

pushd "%~dp0"
set "APP=%CD%\Minecraft Texture Editor-0.1.0-portable.exe"

if not exist "%APP%" (
    echo Application executable was not found:
    echo "%APP%"
    popd
    pause
    exit /b 1
)

start "" /D "%~dp0" "%APP%" %*
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" (
    echo Failed to start the application. Exit code: %EXIT_CODE%
    pause
    exit /b %EXIT_CODE%
)
exit /b 0
