@echo off
setlocal
set "REVERSI_PLUGIN=%~dp0plugins\gpt-reversi-local"
set "REVERSI_NODE=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-x64\node.exe"
if not exist "%REVERSI_NODE%" set "REVERSI_NODE=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-arm64\node.exe"
if not exist "%REVERSI_NODE%" (
  call "%~dp0scripts\setup-runtime.cmd"
  if errorlevel 1 exit /b 1
)
if not exist "%REVERSI_PLUGIN%\node_modules\@modelcontextprotocol\sdk\package.json" (
  call "%~dp0scripts\setup-runtime.cmd"
  if errorlevel 1 exit /b 1
)
set "REVERSI_NODE=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-x64\node.exe"
if not exist "%REVERSI_NODE%" set "REVERSI_NODE=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-arm64\node.exe"
"%REVERSI_NODE%" "%REVERSI_PLUGIN%\launch-http.mjs"
if errorlevel 1 pause
