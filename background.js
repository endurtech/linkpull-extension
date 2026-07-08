// Track background script state
let isServiceWorkerActive = true;

// Safe execution wrapper for chrome API calls
function safeExecute(callback) {
  if (!isServiceWorkerActive) return;
  
  try {
    return callback();
  } catch (error) {
    console.error('Error in background script:', error);
    if (error.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated - disabling functionality');
      isServiceWorkerActive = false;
    }
  }
}

// Function to check if URL appears to point to a file
function hasFileExtension(url) {
  try {
    // Check if the URL is empty or too short to be valid
    if (!url || url.length < 3) {
      return false;
    }
    
    // Make sure URL has a protocol
    let urlToCheck = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      urlToCheck = 'https://' + url;
    }
    
    // Basic validation before trying to construct a URL object
    if (!urlToCheck.includes('.')) {
      return false;
    }
    
    // Try to parse the URL safely
    let urlObj;
    try {
      urlObj = new URL(urlToCheck);
    } catch (e) {
      // If URL construction fails, do a simpler check for file extension
      const parts = urlToCheck.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.includes('.') && 
             lastPart.lastIndexOf('.') < lastPart.length - 1 &&
             lastPart.lastIndexOf('.') > 0;
    }
    
    // If URL object was created successfully, check pathname for extension
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Check if it has a dot followed by some characters (file extension)
    return lastPart.includes('.') && 
           // Make sure the dot isn't at the very end
           lastPart.lastIndexOf('.') < lastPart.length - 1 &&
           // Make sure the dot isn't at the beginning (hidden files like .htaccess)
           lastPart.lastIndexOf('.') > 0;
  } catch (e) {
    console.error('Error checking file extension:', e);
    // Default to false if there's an error parsing the URL
    return false;
  }
}

// Helper function to extract filename from URL
function extractFilenameFromUrl(url) {
  try {
    // Create URL object
    const urlObj = new URL(url);
    
    // Get pathname and split by /
    const pathname = urlObj.pathname;
    const pathParts = pathname.split('/');
    
    // Get the last part which should be the filename
    const lastPart = pathParts[pathParts.length - 1];
    
    // If last part has a file extension, return it
    if (lastPart && lastPart.includes('.') && 
        lastPart.lastIndexOf('.') < lastPart.length - 1 &&
        lastPart.lastIndexOf('.') > 0) {
      return lastPart;
    }
    
    return null;
  } catch (e) {
    console.error('Error extracting filename:', e);
    return null;
  }
}

// Simple function to extract filename from URL
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || null;
  } catch (e) {
    return null;
  }
}

// Function to handle URL downloads
function downloadUrl(url, sender) {
  if (!isServiceWorkerActive) return;
  
  // Ensure URL has a protocol
  let downloadUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    downloadUrl = 'https://' + url;
  }
  
  // Check if the URL has a file extension
  if (!hasFileExtension(downloadUrl)) {
    console.log('URL does not appear to be a file');
    
    // If this came from content script, send message back
    if (sender && sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'showWarning',
        message: 'The URL does not appear to be a direct file link. It may not download correctly.'
      });
    }
    
    // Send response to popup if it was initiated there
    return { success: false, error: 'Not a file URL' };
  }
  
  // Proceed with download
  safeExecute(() => {
    // Simple options for download
    const options = {
      url: downloadUrl,
      saveAs: true
    };
    
    // Get filename if possible to preserve extension
    const filename = getFilenameFromUrl(downloadUrl);
    if (filename && filename.includes('.')) {
      options.filename = filename;
    }
    
    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
      } else {
        console.log('Download started');
        addToHistory(downloadUrl);
      }
    });
  });
  
  return { success: true };
}

// Function to add URL to history
function addToHistory(url) {
  if (!isServiceWorkerActive) return;
  
  safeExecute(() => {
    chrome.storage.local.get(['downloadHistory'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error getting history:', chrome.runtime.lastError);
        return;
      }
      
      let history = result.downloadHistory || [];
      
      // Add new URL to the beginning
      history.unshift(url);
      // Keep only the last 5 items
      history = history.slice(0, 5);
      // Save updated history
      chrome.storage.local.set({ downloadHistory: history }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving history:', chrome.runtime.lastError);
        }
      });
    });
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isServiceWorkerActive) {
    sendResponse({ error: 'Service worker inactive' });
    return false;
  }
  
  console.log('Message received:', message, 'from:', sender);
  
  try {
    if (message.action === 'downloadUrl' && message.url) {
      const result = downloadUrl(message.url, sender);
      sendResponse(result);
    } else if (message.action === 'test') {
      console.log('Test message received from:', message.source || 'content script');
      sendResponse({ success: true, message: 'Background script is active' });
    } else if (message.action === 'validateUrl' && message.url) {
      // Handle cases where the URL might be incomplete (user still typing)
      let isValid = false;
      
      // Only run validation if the URL isn't empty and has some basic structure
      if (message.url && message.url.length > 2) {
        isValid = hasFileExtension(message.url);
      }
      
      sendResponse({ 
        success: true, 
        isValidFileUrl: isValid
      });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    if (error.message.includes('Extension context invalidated')) {
      isServiceWorkerActive = false;
    }
    sendResponse({ error: error.message });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details.reason);
  
  // Set flag for showing update notification
  chrome.storage.local.set({ 'showUpdateNotification': true });
  
  // Register context menu
  try {
    chrome.contextMenus.create({
      id: "downloadLink",
      title: "Pull with LinkPull",
      contexts: ["link", "selection"]
    });
    console.log('Context menu created successfully');
  } catch (error) {
    console.error('Error creating context menu:', error);
  }
});

// Keep service worker alive by handling context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!isServiceWorkerActive) return;
  
  console.log('Context menu clicked:', info);
  if (info.menuItemId === "downloadLink") {
    let urlToDownload;
    
    if (info.linkUrl) {
      // If clicked on a link
      urlToDownload = info.linkUrl;
    } else if (info.selectionText) {
      // If text is selected
      const selectedText = info.selectionText.trim();
      if (isValidUrl(selectedText)) {
        urlToDownload = selectedText;
      } else {
        console.log('Selected text is not a valid URL');
        return;
      }
    }
    
    if (urlToDownload) {
      const result = downloadUrl(urlToDownload);
      if (!result.success) {
        // Create a notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/LP_icon_192x192.png',
          title: 'Download Warning',
          message: 'The URL does not appear to be a direct file link. It may not download correctly.'
        });
      }
    }
  }
});

// Add an alarm to keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

// Handle alarm event to keep service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!isServiceWorkerActive) return;
  
  if (alarm.name === 'keepAlive') {
    console.log('Keep alive alarm triggered');
    
    // Ping storage to help keep the service worker alive
    chrome.storage.local.get('keepAlive', function() {
      // Just accessing storage helps keep service worker alive
    });
  }
});

// Validate URL helper function
function isValidUrl(text) {
  // First, try a more lenient pattern that catches common URL formats
  const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;
  
  if (urlPattern.test(text)) {
    try {
      // If the URL doesn't start with a protocol, add https://
      const urlWithProtocol = text.startsWith('http') ? text : 'https://' + text;
      new URL(urlWithProtocol);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// Service worker error handling using self instead of window
self.onerror = function(message, source, lineno, colno, error) {
  console.error('Service worker error:', message, 'at', source, lineno, colno);
  if (error && error.message && error.message.includes('Extension context invalidated')) {
    isServiceWorkerActive = false;
  }
};

// Handle unhandled promise rejections
self.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  if (event.reason && event.reason.message && event.reason.message.includes('Extension context invalidated')) {
    isServiceWorkerActive = false;
  }
};

// Log that the service worker has started
console.log('LinkPull background script (service worker) started'); 