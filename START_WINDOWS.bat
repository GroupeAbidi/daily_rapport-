@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installation des dependances...
  call npm.cmd install
)
echo.
echo ABIDI Minoterie Daily demarre sur http://localhost:4173
call npm.cmd run dev
pause
