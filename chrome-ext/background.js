// Background script for Spotify Album Downloader
chrome.runtime.onInstalled.addListener(() => {
    console.log('Spotify Album Downloader installed');
    
    // Clear existing context menu items and create new ones
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'downloadAlbum',
            title: 'Download Album/Single',
            contexts: ['page'],
            documentUrlPatterns: ['*://open.spotify.com/album/*']
        }, () => {
            if (chrome.runtime.lastError) {
                console.log('Context menu creation error (can be ignored):', chrome.runtime.lastError);
            }
        });
        
        chrome.contextMenus.create({
            id: 'downloadDiscography',
            title: 'Download Discography',
            contexts: ['page'],
            documentUrlPatterns: ['*://open.spotify.com/artist/*/discography/*']
        }, () => {
            if (chrome.runtime.lastError) {
                console.log('Context menu creation error (can be ignored):', chrome.runtime.lastError);
            }
        });
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadAlbum') {
        console.log('Download request received:', request.data);
        // The actual download is handled by the content script communicating with the Python backend
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
});

// Check if the Python backend is running
async function checkBackendHealth() {
    try {
        const response = await fetch('http://localhost:8080/health');
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Notification for when backend is not running
chrome.action.onClicked.addListener(async (tab) => {
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
        console.log('Backend is not running. Please start run_server.bat first.');
    }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'downloadAlbum') {
        chrome.tabs.sendMessage(tab.id, { action: 'triggerDownload' });
    } else if (info.menuItemId === 'downloadDiscography') {
        chrome.tabs.sendMessage(tab.id, { action: 'triggerDiscographyDownload' });
    }
});

console.log('Spotify Album Downloader background script loaded'); 