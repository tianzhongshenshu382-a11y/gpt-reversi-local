@echo off
setlocal
set "REVERSI_NODE=%~dp0.runtime\node-v24.19.0-win-x64\node.exe"
if not exist "%REVERSI_NODE%" set "REVERSI_NODE=%~dp0.runtime\node-v24.19.0-win-arm64\node.exe"
if not exist "%REVERSI_NODE%" (
  echo Run setup.cmd before installing this plugin. 1>&2
  exit /b 1
)
"%REVERSI_NODE%" "%~dp0stdio.mjs"
