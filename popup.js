// Track popup script state
let isExtensionValid = true;

// Wrap chrome API calls in error handling
function safeExecute(callback) {
  if (!isExtensionValid) return;
  
  try {
    return callback();
  } catch (error) {
    console.error('Error in popup script:', error);
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated - disabling functionality');
      isExtensionValid = false;
      
      // Show error message to user
      const container = document.querySelector('.container');
      if (container) {
        container.innerHTML = '<div class="error-notice">Extension needs to be reloaded. Please refresh the page or close and reopen the popup.</div>';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup script loaded');
  
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadUrl = document.getElementById('downloadUrl');
  const errorMessage = document.getElementById('errorMessage');
  const historyList = document.getElementById('historyList');
  const historyContainer = document.getElementById('historyContainer');
  const clearHistory = document.getElementById('clearHistory');
  const updateNotification = document.getElementById('updateNotification');
  const closeUpdate = document.getElementById('closeUpdate');
  const urlValidityIndicator = document.getElementById('urlValidityIndicator');
  
  // Set initial indicator state
  urlValidityIndicator.classList.add('neutral');
  
  // Disable download button by default
  downloadBtn.disabled = true;
  
  // Add a debounce timer for URL validation
  let validationTimer = null;
  
  // Check if the update notification should be shown
  checkUpdateNotification();
  
  // Load history when popup opens
  loadHistory();

  // Function to check if update notification should be shown
  function checkUpdateNotification() {
    console.log('Checking if update notification should be shown');
    safeExecute(() => {
      chrome.storage.local.get(['showUpdateNotification'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error checking update notification:', chrome.runtime.lastError);
          return;
        }
        
        console.log('Update notification status:', result.showUpdateNotification);
        if (result.showUpdateNotification) {
          updateNotification.classList.remove('hidden');
        } else {
          updateNotification.classList.add('hidden');
        }
      });
    });
  }
  
  // Helper function to extract file extension from URL
  function extractFileExtension(url) {
    try {
      // Create URL object (adding protocol if needed)
      const urlWithProtocol = url.startsWith('http') ? url : 'https://' + url;
      const urlObj = new URL(urlWithProtocol);
      
      // Get pathname and split by /
      const pathname = urlObj.pathname;
      const pathParts = pathname.split('/');
      
      // Get the last part which should be the filename
      const lastPart = pathParts[pathParts.length - 1];
      
      // If last part has a dot, extract extension
      if (lastPart && lastPart.includes('.')) {
        const parts = lastPart.split('.');
        if (parts.length > 1) {
          return parts[parts.length - 1].toLowerCase();
        }
      }
      
      return null;
    } catch (e) {
      console.error('Error extracting file extension:', e);
      return null;
    }
  }
  
  // Function to validate URL in real-time with debounce
  function validateUrlRealTime(url) {
    // Reset indicator classes
    urlValidityIndicator.classList.remove('valid', 'invalid');
    urlValidityIndicator.classList.add('neutral');
    downloadBtn.disabled = true;
    
    // Clear any previous validation timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }
    
    // Don't validate if empty or too short
    if (!url || url.trim() === '' || url.trim().length < 3) {
      return false;
    }
    
    // Set a timer to delay validation until user stops typing
    validationTimer = setTimeout(() => {
      // Use the same URL pattern as in isValidUrl
      const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;
      let validFormat = urlPattern.test(url.trim());
      
      if (!validFormat) {
        urlValidityIndicator.classList.remove('neutral');
        urlValidityIndicator.classList.add('invalid');
        return;
      }
      
      // Ensure URL has protocol before sending for validation
      const urlWithProtocol = ensureProtocol(url.trim());
      
      // Then check if it has a file extension
      safeExecute(() => {
        chrome.runtime.sendMessage({
          action: 'validateUrl',
          url: urlWithProtocol
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error validating URL:', chrome.runtime.lastError);
            urlValidityIndicator.classList.remove('neutral');
            urlValidityIndicator.classList.add('invalid');
            return;
          }
          
          urlValidityIndicator.classList.remove('neutral');
          if (response && response.isValidFileUrl) {
            urlValidityIndicator.classList.add('valid');
            downloadBtn.disabled = false;
          } else {
            urlValidityIndicator.classList.add('invalid');
            downloadBtn.disabled = true;
          }
        });
      });
    }, 300); // Wait 300ms after user stops typing
    
    return true; // Return true to indicate validation is in progress
  }
  
  // Function to dismiss update notification
  if (closeUpdate) {
    closeUpdate.addEventListener('click', function() {
      if (!isExtensionValid) return;
      
      console.log('Update notification closed');
      updateNotification.classList.add('hidden');
      
      safeExecute(() => {
        chrome.storage.local.set({ 'showUpdateNotification': false }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error saving notification status:', chrome.runtime.lastError);
          }
        });
      });
    });
  }

  // Function to load history
  function loadHistory() {
    if (!isExtensionValid) return;
    
    console.log('Loading download history');
    safeExecute(() => {
      chrome.storage.local.get(['downloadHistory'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error loading history:', chrome.runtime.lastError);
          return;
        }
        
        const history = result.downloadHistory || [];
        console.log('Download history:', history);
        if (history.length > 0) {
          displayHistory(history);
        } else {
          historyList.innerHTML = '<div class="empty-history">No download history</div>';
        }
      });
    });
  }

  // Function to display history
  function displayHistory(history) {
    if (!isExtensionValid || !historyList) return;
    
    historyList.innerHTML = '';
    history.forEach((url, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const number = document.createElement('span');
      number.className = 'history-number';
      number.textContent = `${index + 1}.`;
      
      const urlText = document.createElement('span');
      urlText.className = 'history-url';
      urlText.textContent = url;
      urlText.title = url;
      
      item.appendChild(number);
      item.appendChild(urlText);
      
      item.addEventListener('click', () => {
        if (!isExtensionValid) return;
        downloadUrl.value = url;
        // Validate the URL from history
        validateUrlRealTime(url);
      });
      
      historyList.appendChild(item);
    });
  }

  // Function to add URL to history
  function addToHistory(url) {
    if (!isExtensionValid) return;
    
    safeExecute(() => {
      chrome.storage.local.get(['downloadHistory'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error getting history for adding:', chrome.runtime.lastError);
          return;
        }
        
        let history = result.downloadHistory || [];
        
        // Show history container if this is the first item
        if (history.length === 0) {
          historyContainer.classList.remove('hidden');
          document.body.classList.add('has-history');
        }
        
        // Add new URL to the beginning
        history.unshift(url);
        // Keep only the last 5 items
        history = history.slice(0, 5);
        // Save updated history
        chrome.storage.local.set({ downloadHistory: history }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error saving history:', chrome.runtime.lastError);
            return;
          }
          displayHistory(history);
        });
      });
    });
  }

  // Function to ensure URL has protocol
  function ensureProtocol(url) {
    if (!url) return url;
    return (url.startsWith('http://') || url.startsWith('https://')) ? url : 'https://' + url;
  }

  // Function to validate URL format
  function isValidUrl(url) {
    // Basic URL pattern check, accepting URLs with or without protocol
    const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;
    
    if (!urlPattern.test(url)) {
      return false;
    }
    
    try {
      // If URL doesn't have protocol, add https://
      const urlWithProtocol = (url.startsWith('http://') || url.startsWith('https://')) ? url : 'https://' + url;
      new URL(urlWithProtocol);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Function to show error message
  function showError(message) {
    if (!errorMessage) return;
    
    console.error('Error:', message);
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
      errorMessage.classList.remove('show');
    }, 5000); // Increased time to 5 seconds for better visibility
  }

  // Function to handle download
  async function handleDownload() {
    if (!isExtensionValid) return;
    
    let url = downloadUrl.value.trim();
    
    if (!url) {
      showError('Please enter a URL');
      return;
    }

    if (!isValidUrl(url)) {
      showError('Please enter a valid URL');
      return;
    }

    // Ensure URL has protocol
    url = ensureProtocol(url);
    
    // First validate if it has a file extension
    safeExecute(() => {
      chrome.runtime.sendMessage({
        action: 'validateUrl',
        url: url
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error validating URL:', chrome.runtime.lastError);
          return;
        }
        
        // Do not proceed with download if not a file URL
        if (response && !response.isValidFileUrl) {
          showError('This URL does not appear to be a direct file link. Download has been blocked.');
          return;
        }
        
        // Proceed with download only if it has a file extension
        chrome.downloads.download({
          url: url,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            showError('Unable to download file: ' + chrome.runtime.lastError.message);
            console.error('Download error:', chrome.runtime.lastError);
          } else {
            // Add to history only if download started successfully
            addToHistory(url);
            downloadUrl.value = '';
            // Reset indicator after successful download
            urlValidityIndicator.classList.remove('valid', 'invalid');
            urlValidityIndicator.classList.add('neutral');
          }
        });
      });
    });
  }

  // Event listeners
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function() {
      if (!isExtensionValid) return;
      handleDownload();
    });
  }
  
  if (downloadUrl) {
    // Add input event listener for real-time validation
    downloadUrl.addEventListener('input', function() {
      validateUrlRealTime(this.value);
    });
    
    downloadUrl.addEventListener('keypress', function(e) {
      if (!isExtensionValid) return;
      if (e.key === 'Enter') {
        handleDownload();
      }
    });
  }

  // Add clear history functionality
  if (clearHistory) {
    clearHistory.addEventListener('click', function() {
      if (!isExtensionValid) return;
      
      console.log('Clearing download history');
      safeExecute(() => {
        chrome.storage.local.set({ downloadHistory: [] }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error clearing history:', chrome.runtime.lastError);
            return;
          }
          historyList.innerHTML = '<div class="empty-history">No download history</div>';
        });
      });
    });
  }

  // Test connection to background script
  safeExecute(() => {
    chrome.runtime.sendMessage({ action: 'test', source: 'popup' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error connecting to background script:', chrome.runtime.lastError);
        
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          isExtensionValid = false;
          const container = document.querySelector('.container');
          if (container) {
            container.innerHTML = '<div class="error-notice">Extension needs to be reloaded. Please refresh the page.</div>';
          }
        }
      } else {
        console.log('Background script response:', response);
      }
    });
  });
  
  // Handle window errors
  window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
      isExtensionValid = false;
    }
  });
  
  // Initial load
  loadHistory();
}); 