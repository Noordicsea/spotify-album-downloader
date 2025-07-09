// Popup script for Spotify Album Downloader
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusInfo = document.getElementById('statusInfo');
const downloadPath = document.getElementById('downloadPath');
const audioFormat = document.getElementById('audioFormat');
const saveSettings = document.getElementById('saveSettings');

// Default settings
const DEFAULT_SETTINGS = {
    downloadPath: 'C:/Users/User/Downloads/SpotifyDownloads',
    audioFormat: 'mp3'
};

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        downloadPath.value = result.downloadPath;
        audioFormat.value = result.audioFormat;
    } catch (error) {
        console.error('Error loading settings:', error);
        downloadPath.value = DEFAULT_SETTINGS.downloadPath;
        audioFormat.value = DEFAULT_SETTINGS.audioFormat;
    }
}

// Save settings to storage
async function saveSettingsToStorage() {
    try {
        await chrome.storage.sync.set({
            downloadPath: downloadPath.value,
            audioFormat: audioFormat.value
        });
        
        // Show success feedback
        const originalText = saveSettings.textContent;
        saveSettings.textContent = 'Settings Saved!';
        saveSettings.style.backgroundColor = '#1db954';
        
        setTimeout(() => {
            saveSettings.textContent = originalText;
            saveSettings.style.backgroundColor = '';
        }, 2000);
        
        // Send settings to backend
        await sendSettingsToBackend();
    } catch (error) {
        console.error('Error saving settings:', error);
        saveSettings.textContent = 'Error Saving';
        saveSettings.style.backgroundColor = '#e22134';
        
        setTimeout(() => {
            saveSettings.textContent = 'Save Settings';
            saveSettings.style.backgroundColor = '';
        }, 2000);
    }
}

// Send settings to backend
async function sendSettingsToBackend() {
    try {
        const response = await fetch('http://localhost:8080/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                downloadPath: downloadPath.value,
                audioFormat: audioFormat.value
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update backend settings');
        }
    } catch (error) {
        console.error('Error sending settings to backend:', error);
    }
}

// Check backend status
async function checkBackendStatus() {
    try {
        const response = await fetch('http://localhost:8080/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
            const data = await response.json();
            statusDot.classList.add('connected');
            statusText.textContent = 'Backend Connected';
            statusInfo.textContent = `Server running on port ${data.port || 8080}`;
            return true;
        } else {
            throw new Error('Backend not responding');
        }
    } catch (error) {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Backend Disconnected';
        statusInfo.innerHTML = 'Please run <code>run_server.bat</code> to start the backend';
        return false;
    }
}

// Initialize popup
async function initialize() {
    await loadSettings();
    await checkBackendStatus();
    
    // Check backend status every 5 seconds
    setInterval(checkBackendStatus, 5000);
}

// Event listeners
saveSettings.addEventListener('click', saveSettingsToStorage);

// Auto-save on input change
downloadPath.addEventListener('change', saveSettingsToStorage);
audioFormat.addEventListener('change', saveSettingsToStorage);

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initialize);

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStatus') {
        // Update status based on download progress
        if (request.status === 'downloading') {
            statusText.textContent = 'Downloading...';
            statusInfo.textContent = request.message || 'Processing your request';
        } else if (request.status === 'completed') {
            statusText.textContent = 'Download Complete';
            statusInfo.textContent = 'Files saved to your download directory';
            setTimeout(() => {
                checkBackendStatus(); // Reset status after 3 seconds
            }, 3000);
        } else if (request.status === 'error') {
            statusText.textContent = 'Download Error';
            statusInfo.textContent = request.message || 'An error occurred';
            setTimeout(() => {
                checkBackendStatus(); // Reset status after 3 seconds
            }, 3000);
        }
    }
    sendResponse({ success: true });
});

console.log('Spotify Album Downloader popup loaded'); 