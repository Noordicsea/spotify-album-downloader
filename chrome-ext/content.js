// Content script for Spotify Album Downloader
let downloadButton = null;
let observer = null;
let discographyInterval = null;
let downloadStatusCache = new Map(); // Cache for download status checks
let isDownloadingDiscography = false;

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

// Function to check if we're on a discography page
function isDiscographyPage() {
    return window.location.href.includes('/discography/');
}

// Function to extract artist name from discography page
function extractArtistFromDiscography() {
    const title = document.title;
    console.log('Discography page title:', title);
    
    // Try multiple patterns to extract artist name
    const patterns = [
        /Spotify – (.+?) - Discography/i,  // "Spotify – Artist - Discography"
        /(.+?) - Discography/i,  // "Artist - Discography"
        /(.+?) discography/i,    // "Artist Discography"
        /(.+?) \| Spotify/,      // "Artist | Spotify"
        /(.+?) - Spotify/,       // "Artist - Spotify"
        /(.+?) on Spotify/,      // "Artist on Spotify"
        /(.+?)$/                 // Just the title without anything
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const artistName = match[1].trim();
            // Skip if it's too generic or contains "Spotify"
            if (artistName.length > 0 && artistName.length < 100 && !artistName.toLowerCase().includes('spotify')) {
                console.log(`Extracted artist name using pattern ${pattern}: ${artistName}`);
                return artistName;
            }
        }
    }
    
    // If title extraction fails, try to find artist name from page elements
    const artistSelectors = [
        'h1[data-encore-id="text"]',
        '.main-entityHeader-title',
        '.main-entityHeader-titleText',
        'h1',
        '[data-testid="entityTitle"]'
    ];
    
    for (const selector of artistSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const artistName = element.textContent.trim();
            if (artistName.length > 0 && artistName.length < 100) {
                console.log(`Extracted artist name from element ${selector}: ${artistName}`);
                return artistName;
            }
        }
    }
    
    console.log('Could not extract artist name from discography page');
    return null;
}

// Function to check if album has been downloaded
async function checkAlbumDownloadStatus(albumName, artist) {
    const cacheKey = `${artist}|${albumName}`;
    
    // Check cache first (valid for 30 seconds)
    if (downloadStatusCache.has(cacheKey)) {
        const cached = downloadStatusCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) {
            return cached.exists;
        }
    }
    
    try {
        const response = await fetch('http://localhost:8080/check-download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                artist: sanitizeFilename(artist),
                album: sanitizeFilename(albumName)
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            const exists = result.exists || false;
            
            // Cache the result
            downloadStatusCache.set(cacheKey, {
                exists: exists,
                timestamp: Date.now()
            });
            
            return exists;
        }
    } catch (error) {
        console.log('Could not check download status:', error);
    }
    return false;
}

// Function to clear old cache entries
function clearOldCacheEntries() {
    const now = Date.now();
    for (const [key, value] of downloadStatusCache.entries()) {
        if (now - value.timestamp > 30000) { // Remove entries older than 30 seconds
            downloadStatusCache.delete(key);
        }
    }
}

// Function to remove duplicate download buttons
function removeDuplicateButtons() {
    const allButtons = document.querySelectorAll('.spotify-album-download-btn');
    const seenUrls = new Set();
    
    allButtons.forEach(button => {
        const albumUrl = button.dataset.albumUrl;
        if (albumUrl) {
            if (seenUrls.has(albumUrl)) {
                // This is a duplicate, remove it
                button.remove();
                console.log('Removed duplicate button for:', albumUrl);
            } else {
                seenUrls.add(albumUrl);
            }
        } else {
            // Button without URL data, might be old format - remove to be safe
            button.remove();
        }
    });
}

// Function to create individual album download buttons
async function createAlbumDownloadButtons() {
    const artist = extractArtistFromDiscography();
    if (!artist) {
        console.log('Could not extract artist name, skipping album buttons');
        return;
    }
    
    console.log('Creating individual album download buttons for:', artist);
    
    // Clean up any existing duplicate buttons first
    removeDuplicateButtons();
    
    // Keep track of albums we've already processed to avoid duplicates
    const processedAlbums = new Set();
    
    // Find all album links and their containers
    const albumSelectors = [
        'div[data-testid="album-card"] a[href*="/album/"]',
        'div[data-testid="release-card"] a[href*="/album/"]',
        'span.encore-text-title-medium a[href*="/album/"]',
        'span[data-encore-id="text"] a[href*="/album/"]',
        'a[href*="/album/"]'
    ];
    
    let albumsFound = 0;
    
    for (const selector of albumSelectors) {
        const albumLinks = document.querySelectorAll(selector);
        console.log(`Found ${albumLinks.length} album links with selector: ${selector}`);
        
        // Process albums in parallel for faster loading
        const albumPromises = Array.from(albumLinks).map(async (link) => {
            const albumUrl = link.href;
            
            // Skip if we've already processed this album URL
            if (processedAlbums.has(albumUrl)) {
                return;
            }
            
            // Check if ANY element in the document already has a button for this album URL
            const existingButtons = document.querySelectorAll('.spotify-album-download-btn');
            for (const existingBtn of existingButtons) {
                if (existingBtn.dataset.albumUrl === albumUrl) {
                    processedAlbums.add(albumUrl);
                    return; // Skip if button already exists for this album URL
                }
            }
            
            // More thorough check for existing buttons near this link
            const containerElement = link.closest('div, li, span, article') || link.parentElement;
            if (containerElement && containerElement.querySelector('.spotify-album-download-btn')) {
                processedAlbums.add(albumUrl);
                return; // Skip if button already exists in this container
            }
            
            let albumName = '';
            
            // Try different ways to get the album name
            if (link.textContent && link.textContent.trim().length > 0) {
                albumName = link.textContent.trim();
            } else if (link.getAttribute('aria-label')) {
                albumName = link.getAttribute('aria-label');
            } else if (link.title) {
                albumName = link.title;
            } else {
                // Try to find album name in parent elements
                const parent = link.closest('[data-testid="album-card"], [data-testid="release-card"], li, div');
                if (parent) {
                    const titleElement = parent.querySelector('span[data-encore-id="text"], .encore-text-title-medium, h3, h4');
                    if (titleElement) {
                        albumName = titleElement.textContent.trim();
                    }
                }
            }
            
            if (albumName && albumUrl && albumUrl.includes('/album/')) {
                albumName = albumName.replace(/\s+/g, ' ').trim();
                
                // Skip if it's too long, too short, or contains unwanted text
                if (albumName.length > 0 && albumName.length < 200 && 
                    !albumName.toLowerCase().includes('spotify') &&
                    !albumName.toLowerCase().includes('advertisement')) {
                    
                    // Mark this album as processed
                    processedAlbums.add(albumUrl);
                    
                    // Check if album has been downloaded
                    const isDownloaded = await checkAlbumDownloadStatus(albumName, artist);
                    
                    // Create the download button
                    const downloadBtn = document.createElement('button');
                    downloadBtn.className = 'spotify-album-download-btn';
                    downloadBtn.dataset.albumUrl = albumUrl; // Store URL for duplicate detection
                    downloadBtn.dataset.albumName = albumName;
                    downloadBtn.dataset.artistName = artist;
                    
                    if (isDownloaded) {
                        // Album already downloaded - show check mark
                        downloadBtn.innerHTML = '✅';
                        downloadBtn.classList.add('downloaded');
                        downloadBtn.disabled = true;
                        downloadBtn.title = `${albumName} - Already Downloaded`;
                        downloadBtn.style.cssText = `
                            background: #535353 !important;
                            border: none !important;
                            border-radius: 4px !important;
                            color: white !important;
                            padding: 4px 8px !important;
                            margin-left: 8px !important;
                            font-size: 12px !important;
                            cursor: default !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 4px !important;
                            opacity: 0.7 !important;
                            font-family: 'Spotify Circular', Helvetica, Arial, sans-serif !important;
                            vertical-align: middle !important;
                            min-width: 20px !important;
                            height: 20px !important;
                            justify-content: center !important;
                        `;
                    } else {
                        // Album not downloaded - show download button
                        downloadBtn.innerHTML = `
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                            </svg>
                        `;
                        downloadBtn.title = `Download ${albumName}`;
                        
                        downloadBtn.style.cssText = `
                            background: #1db954;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            padding: 4px 8px;
                            margin-left: 8px;
                            font-size: 12px;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            transition: all 0.2s;
                            opacity: 0.8;
                            font-family: 'Spotify Circular', Helvetica, Arial, sans-serif;
                            vertical-align: middle;
                            min-width: 20px;
                            height: 20px;
                            justify-content: center;
                        `;
                        
                        downloadBtn.addEventListener('mouseenter', () => {
                            downloadBtn.style.opacity = '1';
                            downloadBtn.style.transform = 'scale(1.05)';
                        });
                        
                        downloadBtn.addEventListener('mouseleave', () => {
                            downloadBtn.style.opacity = '0.8';
                            downloadBtn.style.transform = 'scale(1)';
                        });
                        
                        downloadBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            if (downloadBtn.disabled) return;
                            
                            await downloadAlbumFromDiscography(albumName, albumUrl, artist, downloadBtn);
                        });
                    }
                    
                    // Find the best spot to insert the button - prefer the immediate parent
                    const insertTarget = link.parentElement;
                    if (insertTarget && !insertTarget.querySelector('.spotify-album-download-btn')) {
                        insertTarget.appendChild(downloadBtn);
                        albumsFound++;
                        console.log(`Added ${isDownloaded ? 'check mark' : 'download button'} for: ${albumName}`);
                    }
                }
            }
        });
        
        // Wait for all album checks to complete
        await Promise.all(albumPromises);
        
        if (albumsFound > 0) {
            console.log(`Successfully processed ${albumsFound} albums`);
            break;
        }
    }
    
    if (albumsFound === 0) {
        console.log('No albums found to add download buttons to');
    }
}

// Function to download individual album from discography
async function downloadAlbumFromDiscography(albumName, albumUrl, artist, buttonElement) {
    try {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '⏳';
        buttonElement.style.opacity = '0.6';
        
        console.log(`Starting download: ${albumName} by ${artist}`);
        
        // Check if backend is running first
        const healthCheck = await fetch('http://localhost:8080/health');
        if (!healthCheck.ok) {
            throw new Error('Backend server not running');
        }
        
        // Download the album
        const response = await fetch('http://localhost:8080/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: albumUrl,
                artist: sanitizeFilename(artist),
                album: sanitizeFilename(albumName),
                type: 'album'
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.download_id) {
            buttonElement.innerHTML = '📥';
            console.log(`Download started for ${albumName}, waiting for completion...`);
            
            // Wait for download to complete
            await waitForDownloadCompletion(result.download_id);
            
            // Success - update button to show it's downloaded
            buttonElement.innerHTML = '✅';
            buttonElement.style.backgroundColor = '#535353';
            buttonElement.style.cursor = 'default';
            buttonElement.title = `${albumName} - Downloaded`;
            buttonElement.classList.add('downloaded');
            console.log(`Download completed for ${albumName}`);
            
            // Clear cache for this album so future checks will show it as downloaded
            const cacheKey = `${artist}|${albumName}`;
            downloadStatusCache.delete(cacheKey);
            
            // Don't reset the button - keep it as downloaded
            
        } else {
            throw new Error(result.error || 'Download failed');
        }
        
    } catch (error) {
        console.error(`Download error for ${albumName}:`, error);
        buttonElement.innerHTML = '❌';
        buttonElement.style.backgroundColor = '#e22134';
        
        // Reset button after a few seconds
        setTimeout(() => {
            buttonElement.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
            `;
            buttonElement.style.backgroundColor = '#1db954';
            buttonElement.style.opacity = '0.8';
            buttonElement.disabled = false;
        }, 3000);
    }
}

// Helper function to wait for download completion
async function waitForDownloadCompletion(downloadId) {
    return new Promise((resolve, reject) => {
        const maxPolls = 240; // 10 minutes max (240 * 2.5 seconds)
        let polls = 0;
        
        const poll = async () => {
            try {
                polls++;
                const response = await fetch(`http://localhost:8080/download/status/${downloadId}`);
                const status = await response.json();
                
                if (status.status === 'completed') {
                    resolve();
                } else if (status.status === 'error') {
                    reject(new Error(status.message || 'Download failed'));
                } else if (polls < maxPolls) {
                    setTimeout(poll, 2500); // Poll every 2.5 seconds
                } else {
                    reject(new Error('Download timed out'));
                }
            } catch (error) {
                reject(error);
            }
        };
        
        // Start polling after 1 second
        setTimeout(poll, 1000);
    });
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
                
                // Show track progress if available
                if (status.current_track && status.total_tracks) {
                    progressText = `Downloading... [${status.current_track}/${status.total_tracks}]`;
                } else if (status.progress > 0) {
                    progressText = `Downloading... ${status.progress}%`;
                }
                
                // Override with specific messages for different phases
                if (status.message) {
                    if (status.message.includes('Starting download')) {
                        progressText = 'Starting...';
                    } else if (status.current_track && status.total_tracks) {
                        // Keep the track progress format for downloading tracks
                        progressText = `Downloading... [${status.current_track}/${status.total_tracks}]`;
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
async function initializeExtension() {
    console.log('Initializing extension...');
    console.log('Current URL:', window.location.href);
    
    // Check if we're on a discography page
    if (isDiscographyPage()) {
        console.log('Detected discography page, creating album download buttons...');
        // Wait for the page to load
        setTimeout(async () => {
            console.log('Creating album download buttons after delay...');
            await createAlbumDownloadButtons();
        }, 3000); // Longer delay for discography pages to load all content
    } else if (window.location.href.includes('/album/')) {
        console.log('Detected album page, creating album button...');
        // Wait for the page to load
        setTimeout(() => {
            createDownloadButton();
        }, 2000);
    } else {
        console.log('Not on an album or discography page');
    }
}

// Observer to handle page changes (SPA navigation)
function setupObserver() {
    if (observer) {
        observer.disconnect();
    }
    
    // Clear existing interval
    if (discographyInterval) {
        clearInterval(discographyInterval);
        discographyInterval = null;
    }
    
    let debounceTimer;
    observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/album/')) {
                createDownloadButton();
            } else if (isDiscographyPage()) {
                await createAlbumDownloadButtons();
                // Set up periodic check for new albums only on discography pages
                if (!discographyInterval) {
                    discographyInterval = setInterval(async () => {
                        await createAlbumDownloadButtons();
                        clearOldCacheEntries(); // Clean up old cache entries
                    }, 5000); // Reduced frequency: Check every 5 seconds instead of 3
                }
            } else {
                // Remove album button if it exists
                const existingButton = document.getElementById('spotify-download-button');
                if (existingButton) {
                    existingButton.remove();
                    downloadButton = null;
                }
                // Remove individual album download buttons
                const albumButtons = document.querySelectorAll('.spotify-album-download-btn');
                albumButtons.forEach(btn => btn.remove());
                
                // Clear discography interval when not on discography page
                if (discographyInterval) {
                    clearInterval(discographyInterval);
                    discographyInterval = null;
                }
                
                // Clear cache when leaving discography
                downloadStatusCache.clear();
            }
        }, 1000); // Increased debounce time from 500ms to 1000ms
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
        urlChangeTimer = setTimeout(async () => {
            if (currentUrl.includes('/album/')) {
                createDownloadButton();
            } else if (isDiscographyPage()) {
                await createAlbumDownloadButtons();
            }
        }, 2000); // Increased from 1000ms to 2000ms to reduce duplicate calls
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'triggerDownload') {
        const albumInfo = extractAlbumInfo();
        if (albumInfo) {
            downloadAlbum(albumInfo);
        }
    } else if (request.action === 'triggerDiscographyDownload') {
        // Individual album downloads now, so this isn't used anymore
        console.log('Discography download triggered - but using individual album buttons now');
    }
    sendResponse({ success: true });
});

console.log('Spotify Album Downloader content script loaded'); 