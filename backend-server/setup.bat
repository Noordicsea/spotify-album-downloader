@echo off
echo ====================================
echo Spotify Album Downloader Setup
echo ====================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo Python is installed. Version:
python --version
echo.

:: Check if pip is installed
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip is not installed
    echo Please install pip or reinstall Python
    pause
    exit /b 1
)

echo pip is installed. Version:
pip --version
echo.

:: Create virtual environment
echo Creating virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

:: Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

:: Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

:: Install requirements
echo Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies
    echo Check your internet connection and try again
    pause
    exit /b 1
)

:: Check if ffmpeg is installed
echo Checking for ffmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: ffmpeg is not installed or not in PATH
    echo spotDL requires ffmpeg for audio processing
    echo.
    echo Please install ffmpeg:
    echo 1. Download from https://ffmpeg.org/download.html
    echo 2. Extract to a folder like C:\ffmpeg
    echo 3. Add C:\ffmpeg\bin to your PATH environment variable
    echo.
    echo Or use chocolatey: choco install ffmpeg
    echo Or use winget: winget install ffmpeg
    echo.
    pause
) else (
    echo ffmpeg is installed:
    ffmpeg -version 2>&1 | findstr "ffmpeg version"
)

:: Test spotDL installation
echo.
echo Testing spotDL installation...
spotdl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: spotDL installation failed
    pause
    exit /b 1
) else (
    echo spotDL is installed:
    spotdl --version
)

:: Test get-cover-art installation
echo.
echo Testing get-cover-art installation...
get-cover-art --version >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: get-cover-art might not be installed correctly
    echo This is optional - the extension will still work without it
) else (
    echo get-cover-art is installed:
    get-cover-art --version
)

:: Create downloads directory
echo.
echo Creating downloads directory...
if not exist "%USERPROFILE%\Downloads\SpotifyDownloads" (
    mkdir "%USERPROFILE%\Downloads\SpotifyDownloads"
)

echo.
echo ====================================
echo Setup Complete!
echo ====================================
echo.
echo Next steps:
echo 1. Run 'run_server.bat' to start the backend server
echo 2. Load the Chrome extension in developer mode
echo 3. Go to a Spotify album page and click the download button
echo.
echo Important notes:
echo - Make sure ffmpeg is installed for audio processing
echo - The server must be running for the extension to work
echo - Downloads will be saved to %USERPROFILE%\Downloads\SpotifyDownloads
echo.
pause 