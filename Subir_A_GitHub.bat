@echo off
echo ============================================================
echo   Subiendo proyecto a https://github.com/wellcomm/ordenes-trabajo
echo ============================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo [OK] Subido con exito a GitHub.
) else (
    echo [AVISO] Si todavia no has creado el repositorio en GitHub, crealo primero en:
    echo https://github.com/new con el nombre: ordenes-trabajo
)
echo.
pause
