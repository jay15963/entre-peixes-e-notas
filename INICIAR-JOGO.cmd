@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js para abrir o jogo localmente.
  pause
  exit /b 1
)
echo Abrindo Entre peixes e Notas...
echo Mantenha esta janela aberta enquanto joga.
start "" "http://127.0.0.1:5190/"
node scripts\servir.mjs
pause
