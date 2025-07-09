@echo off
echo ====================================
echo Spotify Album Downloader Server
echo ====================================
echo.

:: Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found
    echo Please run setup.bat first to install dependencies
    pause
    exit /b 1
)

:: Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

:: Check if required packages are installed
echo Checking dependencies...
python -c "import flask, flask_cors" 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Required Python packages not installed
    echo Please run setup.bat first to install dependencies
    pause
    exit /b 1
)

:: Check if spotDL is available
spotdl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: spotDL is not installed or not working
    echo Please run setup.bat first to install dependencies
    pause
    exit /b 1
)

:: Check if port 8080 is available
netstat -an | find "8080" | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Port 8080 is already in use
    echo Please close any other applications using port 8080
    echo Or modify the port in server.py
    pause
)

:: Start the server
echo.
echo Starting backend server...
echo Server will run on http://localhost:8080
echo.
echo Important:
echo - Keep this window open while using the extension
echo - The Chrome extension needs this server to download music
echo - Press Ctrl+C to stop the server
echo.
echo ====================================
echo Server Starting...
echo ====================================
echo.

python server.py

:: If we reach here, the server has stopped
echo.
echo Server stopped.
pause 