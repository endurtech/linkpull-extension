// Constants
const POPUP_ID = 'linkpull-popup';
const WARNING_ID = 'linkpull-warning';
console.log('LinkPull content script loaded');

// Track extension state
let isExtensionValid = true;

// Wrap all chrome API calls with error handling
function safeExecute(callback) {
  if (!isExtensionValid) return;
  
  try {
    return callback();
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated - disabling functionality');
      isExtensionValid = false;
      
      // Remove all event listeners and popups
      cleanupExtension();
    } else {
      console.error('Error in content script:', error);
    }
  }
}

// Function to clean up when extension context is invalidated
function cleanupExtension() {
  try {
    hidePopup();
    hideWarning();
    // Remove all event listeners
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('beforeunload', hidePopup);
  } catch (e) {
    // Ignore any errors during cleanup
  }
}

// Helper functions
function isValidUrl(text) {
  // First, try a more lenient pattern that catches common URL formats
  const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;
  
  if (urlPattern.test(text)) {
    try {
      // Try to create a proper URL object
      const urlObj = new URL(text.startsWith('http') ? text : 'https://' + text);
      return true;
    } catch (e) {
      // If URL creation fails, it's still not a valid URL
      return false;
    }
  }
  return false;
}

// Create warning message for non-file URLs
function createWarningElement(message) {
  hideWarning(); // Remove any existing warning first
  
  const warning = document.createElement('div');
  warning.id = WARNING_ID;
  warning.classList.add('linkpull-warning');
  
  const warningText = document.createElement('div');
  warningText.textContent = message || 'The URL does not appear to be a direct file link. It may not download correctly.';
  
  const closeButton = document.createElement('span');
  closeButton.classList.add('close-warning');
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', hideWarning);
  
  warning.appendChild(warningText);
  warning.appendChild(closeButton);
  document.body.appendChild(warning);
  
  // Auto-hide warning after 5 seconds
  setTimeout(hideWarning, 5000);
  
  return warning;
}

// Show warning message
function showWarning(message) {
  if (!isExtensionValid) return;
  
  createWarningElement(message);
}

// Hide warning
function hideWarning() {
  const existingWarning = document.getElementById(WARNING_ID);
  if (existingWarning) {
    existingWarning.remove();
  }
}

// Create popup element
function createPopupElement() {
  if (!isExtensionValid) return null;
  
  console.log('Creating popup element');
  const popup = document.createElement('div');
  popup.id = POPUP_ID;
  popup.classList.add('linkpull-popup');
  
  const icon = document.createElement('img');
  let iconUrl;
  
  try {
    iconUrl = chrome.runtime.getURL('icons/LP_icon_32x32.png');
    console.log('Icon URL:', iconUrl);
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      isExtensionValid = false;
      return null;
    }
    // Fallback to data URL if chrome API fails
    iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC5ElEQVR4AcWWA7DszBqG3/Rum23btm3btm3btm3btm3bZ29qfZPMTKanZ3fvVO2rmuruJF/eJP2P/vfvT0OvHRbyT29xGf/w2D/jomUJdz8HE+5+tKfBh3swlNmGzyWeC0zCLc9nWB4F3hl/T4P/RcxBh07CtJuXwCXC5BuWYNIUj9qj1cSwDcBDEITUyFMuwOQzLsIyRLl7HY3dJt20FCbcsW7kkacWkVG9bGXA8ATgMnfbHiZcg/bLTRHV8BDmbNkrYzl/63Fx167BcV/5HsZ++QtMuPwqTDr1dEw4+ZS0HH9S9jjmREw4+EgM22JXdI6oEMOjgCuBm1a/kxFNYyJCXDIMOLUZxr9/Poz//BuM/eQrNR//Ecad9RrGnPAshqEKQZSI4STAHYB8y1/VuSVmhCmFWV98r4S5rLjrr27C4B32zIi4FLgb8PhdgMfuBX7XtjKG6iZHYZFdNRl78Zdq5nDR9FkIGVoxrAFcDvz74GWYf/9jGLz5LgyueRADb9iPgXvvw4Dj92LQEfti3Jl3pPOUJ7P80qcz8rYXsNz5T2TF/U9rWfuUlzL29LdTvlEDYsRdLgCeCvRXBPiv3vvvQ9BQF8O2wA3n7VZm5KnPZuSJj2fYDQ8jqG/BsCXgyoC/AEFjDYZdgDtXgKvlvs0bMWwI/GzAr2/GcCHgFnwYlgYeN+Bvb8VwIeAWfBjmAR405MGGGOZ7F3AJPgwVwGMG/NfDEUaZGJYCLu2BD5s2YbgIcAs+DCsATxjwM9+BYa6E//NLDy7iImDgK98yYFgTuLIH3nh5UisBTxrw995EGHVhOAH4u4f3r8kw3G/I39+CYUngn33wr/cTw1LA8wPgbNXbMKwC/FrEP/sGi0VMsxZwuYDnTngMuFm8HdhJzLqAmwW+6lWnYlgb+CqFv9MJrw34RVvgpLQAtwN+fh88/z01F/uB/wOt2YvzVXp2TAAAAABJRU5ErkJggg==';
  }
  
  icon.src = iconUrl;
  icon.alt = 'Download';
  icon.title = 'Download this URL';
  
  popup.appendChild(icon);
  document.body.appendChild(popup);
  
  return popup;
}

// Position popup near selected text
function positionPopup(popup, selection) {
  if (!popup || !isExtensionValid) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Ensure popup is visible within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let topPosition = window.scrollY + rect.bottom + 5;
  let leftPosition = window.scrollX + rect.right - 40;
  
  // Adjust if popup would go off-screen
  if (leftPosition < 0) leftPosition = 0;
  if (leftPosition + 40 > window.scrollX + viewportWidth) {
    leftPosition = window.scrollX + viewportWidth - 40;
  }
  
  console.log('Positioning popup at:', topPosition, leftPosition);
  popup.style.top = `${topPosition}px`;
  popup.style.left = `${leftPosition}px`;
  
  // Make sure the popup is visible
  popup.style.display = 'flex';
}

// Show popup
function showPopup(selection) {
  if (!isExtensionValid) return;
  
  // Remove any existing popup
  hidePopup();
  
  // Create and position new popup
  const popup = createPopupElement();
  if (!popup) return;
  
  positionPopup(popup, selection);
  
  // Get selected text
  const selectedText = selection.toString().trim();
  console.log('Selected text (URL):', selectedText);
  
  // Add click event to download the URL
  popup.addEventListener('click', function() {
    if (!isExtensionValid) return;
    
    console.log('Popup clicked, sending message to download:', selectedText);
    
    // Add http:// prefix if needed
    let urlToDownload = selectedText;
    if (!urlToDownload.startsWith('http://') && !urlToDownload.startsWith('https://')) {
      urlToDownload = 'https://' + urlToDownload;
    }
    
    safeExecute(() => {
      // First check if it's a valid file URL
      chrome.runtime.sendMessage({
        action: 'validateUrl',
        url: urlToDownload
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error validating URL:', chrome.runtime.lastError);
          return;
        }
        
        // If it's not valid, show a warning but still allow download
        if (response && !response.isValidFileUrl) {
          showWarning('The URL does not appear to be a direct file link. It may not download correctly.');
        }
        
        // Proceed with download regardless
        chrome.runtime.sendMessage({
          action: 'downloadUrl',
          url: urlToDownload
        }, (downloadResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending download message:', chrome.runtime.lastError);
          } else {
            console.log('Download message response:', downloadResponse);
          }
        });
      });
    });
    
    hidePopup();
  });
}

// Hide popup
function hidePopup() {
  const existingPopup = document.getElementById(POPUP_ID);
  if (existingPopup) {
    console.log('Removing existing popup');
    existingPopup.remove();
  }
}

// Handle text selection
function handleSelection() {
  if (!isExtensionValid) return;
  
  try {
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed) {
      hidePopup();
      return;
    }
    
    const selectedText = selection.toString().trim();
    console.log('Text selected:', selectedText);
    
    if (selectedText && isValidUrl(selectedText)) {
      console.log('Valid URL detected, showing popup');
      showPopup(selection);
    } else {
      console.log('Not a valid URL:', selectedText);
      hidePopup();
    }
  } catch (error) {
    console.error('Error handling selection:', error);
    if (error.message.includes('Extension context invalidated')) {
      isExtensionValid = false;
    }
  }
}

// Event handler functions with proper error handling
function handleMouseUp(e) {
  if (!isExtensionValid) return;
  
  // Don't show popup if clicked on the popup itself
  if (e.target.closest && e.target.closest('#' + POPUP_ID)) {
    return;
  }
  
  setTimeout(() => {
    safeExecute(() => handleSelection());
  }, 50);
}

function handleKeyUp(e) {
  if (!isExtensionValid) return;
  
  // Only trigger on key combinations that might change selection
  const selectionKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                          'Home', 'End', 'PageUp', 'PageDown', 'Shift'];
  if (selectionKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
    setTimeout(() => {
      safeExecute(() => handleSelection());
    }, 50);
  }
}

function handleMouseDown(e) {
  if (!isExtensionValid) return;
  
  const popup = document.getElementById(POPUP_ID);
  if (popup && !popup.contains(e.target)) {
    hidePopup();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isExtensionValid) return;
  
  console.log('Message received in content script:', message);
  
  if (message.action === 'showWarning' && message.message) {
    showWarning(message.message);
  }
  
  sendResponse({ received: true });
});

// Listen for text selection with a delay to ensure complete selection
document.addEventListener('mouseup', handleMouseUp);

// Listen for key events that might change selection
document.addEventListener('keyup', handleKeyUp);

// Hide popup when clicking elsewhere
document.addEventListener('mousedown', handleMouseDown);

// Test connection to background script - wrapped in try/catch
try {
  chrome.runtime.sendMessage({
    action: 'test',
    message: 'Content script loaded'
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error connecting to background script:', chrome.runtime.lastError);
      if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
        isExtensionValid = false;
        cleanupExtension();
      }
    } else {
      console.log('Connection to background script successful');
    }
  });
} catch (error) {
  console.error('Error testing connection:', error);
  if (error.message.includes('Extension context invalidated')) {
    isExtensionValid = false;
    cleanupExtension();
  }
}

// Run initial check in case text is already selected
setTimeout(() => {
  safeExecute(() => handleSelection());
}, 500);

// Clean up when navigating away
window.addEventListener('beforeunload', hidePopup); 