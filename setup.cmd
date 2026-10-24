@echo off
call "%~dp0scripts\setup-runtime.cmd" %*
if errorlevel 1 pause
