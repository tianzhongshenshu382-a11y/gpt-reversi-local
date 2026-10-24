@echo off
setlocal
set "REVERSI_PLUGIN=%~dp0..\plugins\gpt-reversi-local"
set "REVERSI_ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "REVERSI_ARCH=arm64"
set "REVERSI_NODE_DIR=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-%REVERSI_ARCH%"
set "REVERSI_NODE=%REVERSI_NODE_DIR%\node.exe"
if exist "%REVERSI_NODE%" goto dependencies
set "REVERSI_ARCHIVE=%REVERSI_PLUGIN%\.runtime\node-v24.19.0-win-%REVERSI_ARCH%.zip"
set "REVERSI_NODE_HASH=57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73"
if "%REVERSI_ARCH%"=="arm64" set "REVERSI_NODE_HASH=8502f4a50b458d4cc38ed8f2001556c2cd239d464920f74017926ccb1e1c157f"
if not exist "%REVERSI_PLUGIN%\.runtime" mkdir "%REVERSI_PLUGIN%\.runtime"
echo Downloading official Node.js into this folder...
curl.exe --fail --location --silent --show-error "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-%REVERSI_ARCH%.zip" --output "%REVERSI_ARCHIVE%"
if errorlevel 1 exit /b 1
certutil.exe -hashfile "%REVERSI_ARCHIVE%" SHA256 | findstr.exe /i /x "%REVERSI_NODE_HASH%" >nul
if errorlevel 1 exit /b 1
tar.exe -xf "%REVERSI_ARCHIVE%" -C "%REVERSI_PLUGIN%\.runtime"
if errorlevel 1 exit /b 1
:dependencies
pushd "%REVERSI_PLUGIN%"
if "%~1"=="--lock-only" (
  "%REVERSI_NODE%" "%REVERSI_NODE_DIR%\node_modules\npm\bin\npm-cli.js" install --package-lock-only --ignore-scripts --no-audit --no-fund --cache "%REVERSI_PLUGIN%\.runtime\npm-cache"
) else (
  "%REVERSI_NODE%" "%REVERSI_NODE_DIR%\node_modules\npm\bin\npm-cli.js" ci --ignore-scripts --no-audit --no-fund --cache "%REVERSI_PLUGIN%\.runtime\npm-cache"
)
set "REVERSI_EXIT=%ERRORLEVEL%"
popd
if not "%REVERSI_EXIT%"=="0" exit /b %REVERSI_EXIT%
echo Ready. Runtime and game files are in this downloaded folder.
exit /b 0
