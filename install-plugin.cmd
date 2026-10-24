@echo off
setlocal
call "%~dp0scripts\setup-runtime.cmd"
if errorlevel 1 exit /b 1
where.exe codex >nul 2>nul
if errorlevel 1 (
  echo Codex CLI is not on PATH. See the local-plugin instructions in README.md.
  exit /b 2
)
codex plugin marketplace add "%~dp0."
if errorlevel 1 exit /b 1
codex plugin add gpt-reversi-local@gpt-game-local-validation
if errorlevel 1 exit /b 1
echo Installed. Open a new LOCAL chat in the supported desktop app.
echo If the tools do not appear, restart the desktop app after saving your work.
