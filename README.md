# Spotify Album Downloader

A Chrome extension that allows you to download entire Spotify albums and singles using spotDL, with automatic cover art correction using get-cover-art.

## Features

- 🎵 **Download entire albums or singles** from Spotify with one click
- 🎨 **Automatic cover art correction** using get-cover-art
- 📁 **Organized file structure** (Artist/Album or Artist/Singles)
- 🔧 **Windows filename sanitization** to handle special characters
- 🎛️ **Customizable settings** (download path, audio format)
- 🖥️ **Clean, Spotify-styled interface**

## Requirements

- **Windows 10/11** (Target OS)
- **Python 3.7+** with pip
- **Chrome Browser** (or Chromium-based browser)
- **FFmpeg** (for audio processing)
- **Internet connection** (for downloading)

## Installation

### 1. Download the Extension

Clone or download this repository to your computer:

```bash
git clone https://github.com/yourusername/spotify-album-downloader.git
cd spotify-album-downloader
```

### 2. Set Up the Backend

Run the setup script to install all Python dependencies:

```bash
setup.bat
```

This will:
- Create a Python virtual environment
- Install all required packages (Flask, spotDL, get-cover-art, etc.)
- Check for FFmpeg installation
- Create the default download directory

### 3. Install FFmpeg (if not already installed)

FFmpeg is required for audio processing. Install it using one of these methods:

**Option 1: Using Chocolatey**
```bash
choco install ffmpeg
```

**Option 2: Using winget**
```bash
winget install ffmpeg
```

**Option 3: Manual Installation**
1. Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH environment variable

### 4. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the folder containing this project
5. The extension should now appear in your extensions list

### 5. Add Extension Icons (Optional)

Place icon files in the `icons/` directory:
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

See `icons/README.md` for details.

## Usage

### 1. Start the Backend Server

Run the server script:

```bash
run_server.bat
```

Keep this window open while using the extension. The server runs on `http://localhost:8080`.

### 2. Configure Settings

1. Click the extension icon in Chrome's toolbar
2. Set your preferred download path and audio format
3. Click "Save Settings"

### 3. Download Music

1. Go to any Spotify album or single page (e.g., `https://open.spotify.com/album/...`)
2. You'll see a green "Download" button appear on the page
3. Click the button to start downloading
4. The button will show progress and completion status

## How It Works

### Album/Single Detection

The extension analyzes the page title to determine:
- **Artist name**: Extracted from the title
- **Album/Single name**: Extracted from the title
- **Type**: Determined by whether the title contains "Album" or "Single"

Examples:
- `"Think Globally Sing Locally - Album by Pete Seeger | Spotify"` → Album
- `"My Dirty Stream (The Hudson River Song) - Single by Pete Seeger | Spotify"` → Single

### File Organization

Downloads are organized in the following structure:

```
Downloads/
├── Artist Name/
│   ├── Album Name/
│   │   ├── 01 - Song Name.mp3
│   │   ├── 02 - Song Name.mp3
│   │   └── cover.jpg
│   └── Singles/
│       ├── Single Name.mp3
│       └── cover.jpg
```

### Filename Sanitization

The extension automatically sanitizes filenames for Windows compatibility:
- Removes illegal characters: `< > : " / \ | ? *`
- Handles reserved Windows names (CON, PRN, AUX, etc.)
- Replaces multiple spaces with single spaces
- Trims leading/trailing spaces and dots

## Technical Details

### Architecture

- **Chrome Extension**: Injects download button and handles UI
- **Python Backend**: Flask server that processes download requests
- **spotDL**: Downloads audio files from Spotify URLs
- **get-cover-art**: Ensures proper album artwork

### API Endpoints

- `GET /health` - Server health check
- `POST /settings` - Update download settings
- `POST /download` - Start album download
- `GET /download/status/<id>` - Check download status
- `GET /downloads` - List all downloads

### File Structure

```
spotify-album-downloader/
├── manifest.json          # Chrome extension manifest
├── content.js             # Content script (injected into Spotify pages)
├── background.js          # Background script
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Button styling
├── server.py              # Python backend server
├── requirements.txt       # Python dependencies
├── setup.bat              # Windows setup script
├── run_server.bat         # Server startup script
├── icons/                 # Extension icons
└── README.md              # This file
```

## Troubleshooting

### Extension Not Working

1. **Check if backend is running**: Look for "Backend Connected" in the extension popup
2. **Restart the server**: Close and run `run_server.bat` again
3. **Check browser console**: Press F12 on Spotify page and look for errors
4. **Reload extension**: Go to `chrome://extensions/` and reload the extension

### Download Failures

1. **Check FFmpeg**: Ensure FFmpeg is installed and in PATH
2. **Check internet connection**: Both Spotify and YouTube access required
3. **Check disk space**: Ensure enough space in download directory
4. **Check permissions**: Ensure write permissions to download directory

### Common Issues

**"Backend Disconnected"**
- The Python server is not running
- Run `run_server.bat` to start the server

**"spotDL failed"**
- FFmpeg not installed or not in PATH
- Internet connection issues
- Invalid Spotify URL

**"Download button not appearing"**
- Page hasn't fully loaded yet (wait a few seconds)
- Not on a Spotify album/single page
- Extension not loaded properly

## Limitations

- **Windows only**: Designed specifically for Windows file system
- **Chrome only**: Built for Chrome/Chromium browsers
- **Spotify albums/singles only**: Does not work with playlists
- **Requires backend**: Python server must be running
- **Internet dependent**: Requires active internet connection

## Legal Notice

This tool is for personal use only. Please respect copyright laws and Spotify's terms of service. Only download music you have the right to download.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the console logs (F12 in browser)
3. Check the Python server output
4. Create an issue on GitHub with details

## Acknowledgments

- **spotDL** - For the excellent Spotify downloading functionality
- **get-cover-art** - For album artwork management
- **Flask** - For the simple and effective backend framework
- **Spotify** - For the music streaming service (please support artists!) 