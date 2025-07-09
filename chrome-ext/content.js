// Content script for Spotify Album Downloader
let downloadButton = null;
let observer = null;

// Function to sanitize filename for Windows
function sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_')
                   .replace(/\s+/g, ' ')
                   .trim();
}

// Function to extract album info from page title
function extractAlbumInfo() {
    const title = document.title;
    console.log('Page title:', title);
    
    // Examples:
    // "Think Globally Sing Locally - Album by Pete Seeger | Spotify"
    // "My Dirty Stream (The Hudson River Song) - Single by Pete Seeger | Spotify"
    
    const regex = /(.+?) - (Album|Single) by (.+?) \| Spotify/;
    const match = title.match(regex);
    
    if (match) {
        return {
            name: match[1].trim(),
            type: match[2].toLowerCase(),
            artist: match[3].trim(),
            url: window.location.href
        };
    }
    
    return null;
}

// Function to create download button
function createDownloadButton() {
    // Check if button already exists
    if (document.getElementById('spotify-download-button')) {
        return;
    }
    
    const albumInfo = extractAlbumInfo();
    if (!albumInfo) {
        console.log('Could not extract album info from page title');
        return;
    }
    
    // Create button element
    downloadButton = document.createElement('button');
    downloadButton.id = 'spotify-download-button';
    downloadButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        Download ${albumInfo.type}
    `;
    
    downloadButton.addEventListener('click', async () => {
        await downloadAlbum(albumInfo);
    });
    
    // Find a good spot to insert the button
    const targetSelectors = [
        '[data-testid="action-bar-row"]',
        '[data-testid="more-button"]',
        '.main-actionBar-ActionBar',
        '.main-actionBarRow-ActionBarRow'
    ];
    
    for (const selector of targetSelectors) {
        const target = document.querySelector(selector);
        if (target) {
            target.appendChild(downloadButton);
            console.log('Download button added to:', selector);
            break;
        }
    }
}

// Function to poll download status
async function pollDownloadStatus(downloadId, albumInfo) {
    const maxPolls = 120; // 5 minutes max (120 * 2.5 seconds)
    let polls = 0;
    
    const poll = async () => {
        try {
            polls++;
            const response = await fetch(`http://localhost:8080/download/status/${downloadId}`);
            const status = await response.json();
            
            console.log(`Poll ${polls}: Download status:`, status);
            
            if (status.status === 'completed') {
                downloadButton.textContent = 'Download Complete!';
                downloadButton.style.backgroundColor = '#1db954';
                setTimeout(() => {
                    downloadButton.textContent = `Download ${albumInfo.type}`;
                    downloadButton.style.backgroundColor = '';
                    downloadButton.disabled = false;
                }, 3000);
                return;
            } else if (status.status === 'error') {
                throw new Error(status.message || 'Download failed');
            } else if (status.status === 'downloading') {
                // Update button with progress
                let progressText = 'Downloading...';
                if (status.progress > 0) {
                    progressText = `Downloading... ${status.progress}%`;
                }
                if (status.message) {
                    if (status.message.includes('spotDL')) {
                        progressText = 'Downloading tracks...';
                    } else if (status.message.includes('cover art')) {
                        progressText = 'Adding cover art...';
                    }
                }
                downloadButton.textContent = progressText;
                
                // Continue polling if not exceeded max attempts
                if (polls < maxPolls) {
                    setTimeout(poll, 2500); // Poll every 2.5 seconds
                } else {
                    throw new Error('Download timed out');
                }
            } else {
                // Unknown status, continue polling
                if (polls < maxPolls) {
                    setTimeout(poll, 2500);
                } else {
                    throw new Error('Download status unknown');
                }
            }
        } catch (error) {
            console.error('Status polling error:', error);
            downloadButton.textContent = 'Download Failed';
            downloadButton.style.backgroundColor = '#e22134';
            setTimeout(() => {
                downloadButton.textContent = `Download ${albumInfo.type}`;
                downloadButton.style.backgroundColor = '';
                downloadButton.disabled = false;
            }, 3000);
        }
    };
    
    // Start polling
    setTimeout(poll, 1000); // Start checking after 1 second
}

// Function to handle download
async function downloadAlbum(albumInfo) {
    try {
        downloadButton.disabled = true;
        downloadButton.textContent = 'Starting...';
        
        console.log('Starting download for:', albumInfo);
        
        // Check if backend is running first
        const healthCheck = await fetch('http://localhost:8080/health');
        if (!healthCheck.ok) {
            throw new Error('Backend server is not running. Please start run_server.bat first.');
        }
        
        const response = await fetch('http://localhost:8080/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: albumInfo.url,
                artist: sanitizeFilename(albumInfo.artist),
                album: sanitizeFilename(albumInfo.name),
                type: albumInfo.type
            })
        });
        
        const result = await response.json();
        console.log('Download response:', result);
        
        if (response.ok && result.download_id) {
            downloadButton.textContent = 'Downloading...';
            // Start polling for status updates
            pollDownloadStatus(result.download_id, albumInfo);
        } else {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        console.error('Download error:', error);
        downloadButton.textContent = 'Download Failed';
        downloadButton.style.backgroundColor = '#e22134';
        
        // Show error message for common issues
        if (error.message.includes('Backend server is not running')) {
            console.log('Backend server is not running. Please start run_server.bat');
        } else if (error.message.includes('Failed to fetch')) {
            console.log('Network error. Check if backend server is running on localhost:8080');
        }
        
        setTimeout(() => {
            downloadButton.textContent = `Download ${albumInfo.type}`;
            downloadButton.style.backgroundColor = '';
            downloadButton.disabled = false;
        }, 3000);
    }
}

// Function to initialize the extension
function initializeExtension() {
    // Only run on album pages
    if (!window.location.href.includes('/album/')) {
        return;
    }
    
    // Wait for the page to load
    setTimeout(() => {
        createDownloadButton();
    }, 2000);
}

// Observer to handle page changes (SPA navigation)
function setupObserver() {
    if (observer) {
        observer.disconnect();
    }
    
    let debounceTimer;
    observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/album/')) {
                createDownloadButton();
            } else {
                // Remove button if not on album page
                const existingButton = document.getElementById('spotify-download-button');
                if (existingButton) {
                    existingButton.remove();
                    downloadButton = null;
                }
            }
        }, 500);
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// Setup observer for SPA navigation
setupObserver();

// Handle page navigation with debouncing
let lastUrl = window.location.href;
let urlChangeTimer;
new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        clearTimeout(urlChangeTimer);
        urlChangeTimer = setTimeout(() => {
            if (currentUrl.includes('/album/')) {
                createDownloadButton();
            }
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'triggerDownload') {
        const albumInfo = extractAlbumInfo();
        if (albumInfo) {
            downloadAlbum(albumInfo);
        }
    }
    sendResponse({ success: true });
});

console.log('Spotify Album Downloader content script loaded'); 