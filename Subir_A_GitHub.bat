@echo off
echo ============================================================
echo   Subiendo proyecto a https://github.com/Albertowellcomm/ordenes-trabajo
echo ============================================================
echo.
git add .
git commit -m "Actualizacion: %date% %time%"
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo [OK] Subido con exito a GitHub.
) else (
    echo [AVISO] Comprueba tu conexion o permisos.
)
echo.
pause
