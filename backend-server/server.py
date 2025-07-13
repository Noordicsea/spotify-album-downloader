#!/usr/bin/env python3
"""
Spotify Album Downloader Backend Server
Handles downloads using spotDL and get-cover-art
"""

import os
import re
import json
import subprocess
import threading
import time
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from Chrome extension

# Global settings
SETTINGS = {
    'download_path': os.path.join(os.path.expanduser('~'), 'Downloads', 'SpotifyDownloads'),
    'audio_format': 'mp3'
}

# Track download status
download_status = {}

def sanitize_filename(filename):
    """
    Sanitize filename for Windows filesystem
    Remove illegal characters and replace with safe alternatives
    """
    # Replace problematic characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Replace multiple spaces with single space
    filename = re.sub(r'\s+', ' ', filename)
    # Remove leading/trailing spaces and dots
    filename = filename.strip(' .')
    # Handle reserved Windows names
    reserved_names = ['CON', 'PRN', 'AUX', 'NUL'] + [f'COM{i}' for i in range(1, 10)] + [f'LPT{i}' for i in range(1, 10)]
    if filename.upper() in reserved_names:
        filename = f'_{filename}'
    return filename

def ensure_directory_exists(path):
    """Create directory if it doesn't exist"""
    Path(path).mkdir(parents=True, exist_ok=True)

def run_command(command, cwd=None):
    """Run a command and return the result"""
    print(f"=== RUN_COMMAND CALLED ===")
    print(f"Command: {command}")
    print(f"Working Directory: {cwd}")
    
    try:
        print(f"=== SUBPROCESS.RUN STARTING ===")
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        print(f"=== SUBPROCESS.RUN COMPLETED ===")
        print(f"Return Code: {result.returncode}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        print(f"=== COMMAND TIMED OUT ===")
        return False, "", "Command timed out"
    except Exception as e:
        print(f"=== SUBPROCESS EXCEPTION ===")
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()
        return False, "", str(e)

def download_with_spotdl(url, output_path, audio_format='mp3', download_id=None):
    """
    Download using spotDL with real-time progress tracking
    """
    print(f"=== DOWNLOAD_WITH_SPOTDL CALLED ===")
    print(f"URL: {url}")
    print(f"Output Path: {output_path}")
    print(f"Audio Format: {audio_format}")
    print(f"Download ID: {download_id}")
    
    try:
        # Ensure output directory exists
        ensure_directory_exists(output_path)
        print(f"Output directory ensured: {output_path}")
        
        # spotDL command
        command = f'spotdl "{url}" --output "{output_path}" --format {audio_format}'
        
        print(f"=== EXECUTING COMMAND ===")
        print(f"Command: {command}")
        print(f"Working Directory: {output_path}")
        
        # Run command with real-time output parsing
        import subprocess
        
        try:
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=output_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            output_lines = []
            current_track = 0
            total_tracks = 0
            
            if process.stdout:
                for line in iter(process.stdout.readline, ''):
                    output_lines.append(line)
                    print(f"spotDL output: {line.strip()}")
                    
                    # Parse progress information
                    if download_id and download_id in download_status:
                        # Look for track information in output
                        if "Downloaded" in line and "tracks" in line:
                            # Parse total tracks from output like "Downloaded 16 tracks"
                            import re
                            match = re.search(r'Downloaded (\d+) tracks', line)
                            if match:
                                total_tracks = int(match.group(1))
                                download_status[download_id]['total_tracks'] = total_tracks
                        
                        # Look for individual track download progress
                        if "Downloading:" in line or "Downloaded:" in line:
                            current_track += 1
                            if total_tracks == 0:
                                # If we don't know total tracks yet, estimate from current progress
                                total_tracks = max(current_track, 1)
                            
                            download_status[download_id]['current_track'] = current_track
                            download_status[download_id]['total_tracks'] = total_tracks
                            download_status[download_id]['message'] = f'Downloading track {current_track}...'
                            
                            # Calculate percentage based on track progress
                            if total_tracks > 0:
                                track_progress = (current_track / total_tracks) * 75  # 75% of total progress for downloading
                                download_status[download_id]['progress'] = min(25 + track_progress, 100)
                        
                        # Look for album information to get total tracks
                        if "tracks found" in line:
                            match = re.search(r'(\d+) tracks found', line)
                            if match:
                                total_tracks = int(match.group(1))
                                download_status[download_id]['total_tracks'] = total_tracks
            
            process.wait()
            
            if process.returncode == 0:
                print(f"spotDL success")
                return True, '\n'.join(output_lines)
            else:
                print(f"spotDL error: {process.returncode}")
                return False, '\n'.join(output_lines)
                
        except Exception as e:
            print(f"Process execution error: {e}")
            return False, str(e)
        
    except Exception as e:
        print(f"spotDL exception: {e}")
        import traceback
        traceback.print_exc()
        return False, str(e)



def download_album_thread(download_id, url, artist, album, album_type, audio_format, download_path):
    """
    Download album in a separate thread
    """
    print(f"=== STARTING DOWNLOAD THREAD ===")
    print(f"Download ID: {download_id}")
    print(f"URL: {url}")
    print(f"Artist: {artist}")
    print(f"Album: {album}")
    print(f"Type: {album_type}")
    print(f"Format: {audio_format}")
    print(f"Download Path: {download_path}")
    
    try:
        download_status[download_id] = {
            'status': 'downloading',
            'message': 'Starting download...',
            'progress': 0,
            'current_track': 0,
            'total_tracks': 0
        }
        
        # Sanitize names
        safe_artist = sanitize_filename(artist)
        safe_album = sanitize_filename(album)
        
        print(f"Sanitized Artist: {safe_artist}")
        print(f"Sanitized Album: {safe_album}")
        
        # Create directory structure: Artist/Album or Artist/Singles
        if album_type == 'single':
            album_dir = os.path.join(download_path, safe_artist, 'Singles')
        else:
            album_dir = os.path.join(download_path, safe_artist, safe_album)
        
        print(f"Target Directory: {album_dir}")
        
        ensure_directory_exists(album_dir)
        print(f"Directory created/verified: {album_dir}")
        
        # Update status
        download_status[download_id]['message'] = 'Downloading with spotDL...'
        download_status[download_id]['progress'] = 25
        
        print(f"=== CALLING SPOTDL ===")
        # Download with spotDL
        success, output = download_with_spotdl(url, album_dir, audio_format, download_id)
        print(f"spotDL returned: success={success}, output={output}")
        
        if not success:
            print(f"=== SPOTDL FAILED ===")
            download_status[download_id] = {
                'status': 'error',
                'message': f'spotDL failed: {output}',
                'progress': 0
            }
            return
        
        # Complete
        download_status[download_id] = {
            'status': 'completed',
            'message': f'Download completed: {album_dir}',
            'progress': 100,
            'path': album_dir
        }
        
        print(f"=== DOWNLOAD COMPLETED ===")
        
    except Exception as e:
        print(f"=== DOWNLOAD THREAD EXCEPTION ===")
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()
        
        download_status[download_id] = {
            'status': 'error',
            'message': str(e),
            'progress': 0
        }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Spotify Album Downloader Backend is running',
        'port': 8080
    })

@app.route('/settings', methods=['POST'])
def update_settings():
    """Update settings"""
    try:
        data = request.json
        if 'downloadPath' in data:
            SETTINGS['download_path'] = data['downloadPath']
        if 'audioFormat' in data:
            SETTINGS['audio_format'] = data['audioFormat']
        
        return jsonify({
            'success': True,
            'message': 'Settings updated',
            'settings': SETTINGS
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/download', methods=['POST'])
def download_album():
    """Download album endpoint"""
    try:
        data = request.json
        url = data.get('url')
        artist = data.get('artist')
        album = data.get('album')
        album_type = data.get('type', 'album')
        
        if not all([url, artist, album]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: url, artist, album'
            }), 400
        
        # Generate download ID
        download_id = f"{int(time.time())}_{hash(url)}"
        
        # Start download in background thread
        thread = threading.Thread(
            target=download_album_thread,
            args=(download_id, url, artist, album, album_type, SETTINGS['audio_format'], SETTINGS['download_path'])
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'download_id': download_id,
            'message': 'Download started'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/download/status/<download_id>', methods=['GET'])
def get_download_status(download_id):
    """Get download status"""
    status = download_status.get(download_id, {
        'status': 'not_found',
        'message': 'Download not found',
        'progress': 0
    })
    return jsonify(status)

@app.route('/downloads', methods=['GET'])
def list_downloads():
    """List all downloads"""
    return jsonify(download_status)

if __name__ == '__main__':
    print("Starting Spotify Album Downloader Backend Server...")
    print("Server will run on http://localhost:8080")
    print("Make sure spotDL is installed!")
    print("Press Ctrl+C to stop the server")
    
    try:
        app.run(host='localhost', port=8080, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}") 