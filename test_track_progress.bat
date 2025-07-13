@echo off
echo ====================================
echo Spotify Album Downloader - Track Progress Test
echo ====================================
echo.

echo This script will help you test the new track progress feature.
echo The download button will now show progress like [1/16] [2/16] etc.
echo.

echo Starting backend server...
echo.

cd /d "%~dp0backend-server"

echo Activating virtual environment...
call venv\Scripts\activate

echo.
echo Backend server starting... 
echo IMPORTANT: Keep this window open and follow the instructions below.
echo.

echo ====================================
echo TESTING INSTRUCTIONS:
echo ====================================
echo 1. Keep this window open (backend server running)
echo 2. Open Chrome and go to any Spotify album page
echo 3. Look for the green "Download Album" button
echo 4. Click the button and watch the progress
echo 5. You should see progress like: "Downloading... [1/16]" then "[2/16]" etc.
echo 6. After testing, close this window or press Ctrl+C to stop
echo.

echo ====================================
echo EXPECTED BEHAVIOR:
echo ====================================
echo - Button starts as "Starting..."
echo - Changes to "Downloading... [1/16]"
echo - Updates to "[2/16]", "[3/16]", etc. as each track downloads
echo - Shows "Adding cover art..." when fixing album art
echo - Finally shows "Download Complete!" when done
echo.

echo ====================================
echo LOGS (for analysis):
echo ====================================

python server.py 2>&1 | tee ../track_progress_test.log

echo.
echo Test completed. Log file created: track_progress_test.log
echo Please review the log file for any issues.
pause 