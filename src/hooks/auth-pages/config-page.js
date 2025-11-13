const FIELDS = ['egainUrl', 'authUrl', 'accessTokenUrl', 'clientId', 'redirectUrl', 'clientSecret', 'scopePrefix'];
const FIELD_LABELS = {
  egainUrl: 'eGain URL', authUrl: 'Auth URL', accessTokenUrl: 'Token URL',
  clientId: 'Client ID', redirectUrl: 'Redirect URL', clientSecret: 'Client Secret',
  scopePrefix: 'Scope Prefix'
};

let savedConfigData = null; // Store config in memory only
let authenticationStarted = false; // Track if user started authentication process
let lastSubmittedConfig = null; // Track last submitted config to prevent duplicate submissions
let isSubmitting = false; // Track if form submission is in progress

// Fetch saved config from backend (secure file storage)
async function loadSavedConfig() {
  try {
    const response = await fetch('/get-config');
    if (response.ok) {
      const data = await response.json();
      if (data.config && data.config.egainUrl && data.config.clientId) {
        // Only set if we have valid required fields
        savedConfigData = data.config;
        return true;
      }
    }
  } catch (error) {
    console.error('Could not load saved config:', error);
  }
  savedConfigData = null;
  return false;
}

function hasSavedConfig() {
  return savedConfigData && 
         savedConfigData.egainUrl && 
         savedConfigData.clientId && 
         savedConfigData.authUrl && 
         savedConfigData.accessTokenUrl;
}

function displaySavedConfig() {
  const listEl = document.getElementById('savedConfigList');
  listEl.innerHTML = '';
  if (!savedConfigData) return;
  
  FIELDS.forEach(field => {
    const value = savedConfigData[field];
    if (value) {
      const item = document.createElement('div');
      item.className = 'config-item';
      const label = document.createElement('span');
      label.className = 'config-label';
      label.textContent = FIELD_LABELS[field];
      const valueSpan = document.createElement('span');
      valueSpan.className = 'config-value';
      if (field === 'clientSecret') {
        valueSpan.classList.add('masked');
        valueSpan.textContent = '••••••••';
      } else if (field === 'clientId') {
        valueSpan.textContent = value.substring(0, 8) + '...';
      } else {
        valueSpan.textContent = value.length > 40 ? value.substring(0, 40) + '...' : value;
      }
      item.appendChild(label);
      item.appendChild(valueSpan);
      listEl.appendChild(item);
    }
  });
}

function showQuickSignin() {
  document.getElementById('quickSigninView').style.display = 'block';
  document.getElementById('formView').style.display = 'none';
  displaySavedConfig();
}

function showForm() {
  document.getElementById('quickSigninView').style.display = 'none';
  document.getElementById('formView').style.display = 'block';
  loadFormValues();
}

function loadFormValues() {
  if (!savedConfigData) return;
  
  // Load all field values
  FIELDS.forEach(field => {
    const value = savedConfigData[field];
    if (value) document.getElementById(field).value = value;
  });
  
  // Show advanced settings if clientSecret or scopePrefix exist
  if (savedConfigData.clientSecret || savedConfigData.scopePrefix) {
    toggleAdvancedSettings();
  }
}

async function clearConfigAndShowForm() {
  showModal(
    'Clear All Configuration?',
    'This will delete all saved OAuth settings from your home directory. You will need to re-enter them next time.',
    async (confirmed) => {
      if (confirmed) {
        try {
          const response = await fetch('/clear-config', { method: 'POST' });
          if (response.ok) {
            savedConfigData = null;
            FIELDS.forEach(field => {
              document.getElementById(field).value = '';
            });
            showStatus('Configuration cleared successfully', 'success');
            showForm();
          } else {
            showStatus('Failed to clear configuration', 'error');
          }
        } catch (error) {
          showStatus('Error clearing configuration: ' + error.message, 'error');
        }
      }
    },
    'Clear All'
  );
}

function cancelForm() {
  if (hasSavedConfig()) {
    showQuickSignin();
  } else {
    showModal(
      'Cancel Authentication?',
      "You haven't saved any configuration yet. This will cancel the authentication process.",
      async (confirmed) => {
        if (confirmed) {
          // Notify server that user cancelled
          try {
            await fetch('/cancel', { method: 'POST' });
          } catch (error) {
            console.error('Could not notify server of cancellation:', error);
          }
          window.close();
        }
      },
      'Cancel'
    );
  }
}

async function signInWithSavedConfig() {
  authenticationStarted = true; // Mark that auth has started
  
  // Show loading overlay
  showLoadingOverlay('Redirecting to login...');
  
  try {
    const response = await fetch('/get-oauth-url', { method: 'POST' });
    const result = await response.json();
    
    if (response.ok && result.oauthUrl) {
      console.log('🔗 OAuth URL:', result.oauthUrl);
      // Redirect after a brief delay to show loading state
      setTimeout(() => {
        window.location.href = result.oauthUrl;
      }, 500);
    } else {
      hideLoadingOverlay();
      showStatus('❌ ' + (result.error || 'Failed to get OAuth URL'), 'error');
      authenticationStarted = false; // Reset on error
    }
  } catch (error) {
    hideLoadingOverlay();
    showStatus('❌ Error: ' + error.message, 'error');
    authenticationStarted = false; // Reset on error
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
  statusEl.style.display = 'block';
  // Auto-hide info and success messages after a delay
  if (type === 'info') {
    setTimeout(() => { 
      // Only hide if it's still an info message (not changed to success/error)
      if (statusEl.className === 'status info') {
        statusEl.style.display = 'none'; 
      }
    }, 3000);
  } else if (type === 'success') {
    setTimeout(() => { 
      // Only hide if it's still a success message (not changed to error)
      if (statusEl.className === 'status success') {
        statusEl.style.display = 'none'; 
      }
    }, 4000);
  }
}

function configValuesEqual(config1, config2) {
  // Compare all fields that matter
  const fieldsToCompare = ['egainUrl', 'authUrl', 'accessTokenUrl', 'clientId', 'redirectUrl', 'clientSecret', 'scopePrefix'];
  for (const field of fieldsToCompare) {
    const val1 = (config1[field] || '').trim();
    const val2 = (config2[field] || '').trim();
    if (val1 !== val2) {
      return false;
    }
  }
  return true;
}

function showLoadingOverlay(message) {
  // Show overlay for form view
  const overlay = document.getElementById('loadingOverlay');
  const loadingMessage = document.getElementById('loadingMessage');
  if (overlay) {
    overlay.classList.add('active');
    if (loadingMessage) {
      loadingMessage.textContent = message || 'Saving configuration...';
    }
  }
  
  // Show overlay for quick signin view
  const overlayQuickSignin = document.getElementById('loadingOverlayQuickSignin');
  const loadingMessageQuickSignin = document.getElementById('loadingMessageQuickSignin');
  if (overlayQuickSignin) {
    overlayQuickSignin.classList.add('active');
    if (loadingMessageQuickSignin) {
      loadingMessageQuickSignin.textContent = message || 'Redirecting to login...';
    }
  }
}

function hideLoadingOverlay() {
  // Hide overlay for form view
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
  
  // Hide overlay for quick signin view
  const overlayQuickSignin = document.getElementById('loadingOverlayQuickSignin');
  if (overlayQuickSignin) {
    overlayQuickSignin.classList.remove('active');
  }
}

async function authenticateWithConfig(config) {
  // Prevent duplicate submissions
  if (isSubmitting) {
    return; // Already submitting, ignore
  }
  
  // Check if values have changed since last submission
  if (lastSubmittedConfig && configValuesEqual(config, lastSubmittedConfig)) {
    showStatus('⚠️ Configuration unchanged. Already saved.', 'info');
    return; // Values haven't changed, don't submit again
  }
  
  try {
    isSubmitting = true; // Mark as submitting
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }
    
    // Show loading overlay with spinner
    showLoadingOverlay('Saving configuration...');
    authenticationStarted = true; // Mark that auth has started
    
    const response = await fetch('/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const result = await response.json();
    
    if (response.ok && result.oauthUrl) {
      // Config saved! Store this config as last submitted
      lastSubmittedConfig = { ...config };
      
      console.log('🔗 OAuth URL:', result.oauthUrl);
      
      // Update loading message (overlay already shows the status, no need for status message)
      showLoadingOverlay('Configuration saved! Redirecting to login...');
      
      setTimeout(() => {
        window.location.href = result.oauthUrl;
      }, 500);
    } else if (response.ok && result.success) {
      lastSubmittedConfig = { ...config };
      hideLoadingOverlay();
      showStatus('✅ ' + result.message, 'success');
      setTimeout(() => { window.close(); }, 2000);
    } else {
      hideLoadingOverlay();
      showStatus('❌ ' + (result.error || 'Authentication failed'), 'error');
      authenticationStarted = false; // Reset on error
      isSubmitting = false; // Reset submitting flag
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save & Authenticate';
      }
    }
  } catch (error) {
    hideLoadingOverlay();
    showStatus('❌ Error: ' + error.message, 'error');
    authenticationStarted = false; // Reset on error
    isSubmitting = false; // Reset submitting flag
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Save & Authenticate';
    }
  }
}

document.getElementById('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Prevent duplicate submissions
  if (isSubmitting) {
    return;
  }
  
  const formData = new FormData(e.target);
  const config = {};
  for (let [key, value] of formData.entries()) {
    config[key] = value;
  }
  
  // Config is now sent to backend for secure file storage (not cookies)
  await authenticateWithConfig(config);
});

// Initialize: Load saved config from backend
(async () => {
  const hasConfig = await loadSavedConfig();
  if (hasConfig) {
    showQuickSignin();
  } else {
    showForm();
  }
})();

// Custom modal functions
let modalCallback = null;

function showModal(title, message, callback, confirmText = 'Confirm') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  document.getElementById('modalConfirmBtn').textContent = confirmText;
  modalCallback = callback;
  document.getElementById('confirmModal').classList.add('active');
}

function closeModal(confirmed) {
  document.getElementById('confirmModal').classList.remove('active');
  if (modalCallback) {
    modalCallback(confirmed);
    modalCallback = null;
  }
}

// Advanced settings toggle
function toggleAdvancedSettings() {
  const advancedSection = document.getElementById('advancedSettings');
  const toggleIcon = document.getElementById('advancedToggleIcon');
  
  if (advancedSection.style.display === 'none') {
    advancedSection.style.display = 'block';
    toggleIcon.textContent = '▼';
  } else {
    advancedSection.style.display = 'none';
    toggleIcon.textContent = '▶';
  }
}

// Tooltip functions
function showTooltip(event, fieldName) {
  event.preventDefault();    // Prevent label from focusing input
  event.stopPropagation();   // Prevent event from bubbling
  
  const tooltipId = 'tooltip-' + fieldName;
  let tooltipElement = document.getElementById(tooltipId);
  const button = event.currentTarget;
  
  if (tooltipElement) {
    // Show the tooltip first to get its dimensions
    tooltipElement.classList.add('active');
    
    // Get actual dimensions after showing
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 380;
    const tooltipHeight = tooltipRect.height || 300;
    
    const spacing = 16; // Space between button and tooltip
    const viewportPadding = 10; // Padding from viewport edges
    const horizontalComfortZone = 50; // Extra space needed to avoid cramped horizontal positioning
    
    // Calculate available space on all sides
    const spaceOnRight = window.innerWidth - buttonRect.right;
    const spaceOnLeft = buttonRect.left;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    let left, top;
    let arrowSide = 'left'; // Default: tooltip on right, arrow on left
    
    // Check if horizontal positioning would be too cramped (tooltip might cover the icon)
    const horizontalSpaceTight = (spaceOnRight < tooltipWidth + horizontalComfortZone) && 
                                 (spaceOnLeft < tooltipWidth + horizontalComfortZone);
    
    if (horizontalSpaceTight) {
      // Use vertical positioning to avoid covering the icon
      // Determine if we're in the top or bottom half of the viewport
      const inTopHalf = buttonRect.top < window.innerHeight / 2;
      
      if (inTopHalf && spaceBelow >= tooltipHeight + spacing + viewportPadding) {
        // Position below
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
        top = buttonRect.bottom + spacing;
        arrowSide = 'top';
      } else if (!inTopHalf && spaceAbove >= tooltipHeight + spacing + viewportPadding) {
        // Position above
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
        top = buttonRect.top - tooltipHeight - spacing;
        arrowSide = 'bottom';
      } else if (spaceBelow > spaceAbove) {
        // Not enough vertical space either, prefer below
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
        top = buttonRect.bottom + spacing;
        arrowSide = 'top';
      } else {
        // Prefer above
        left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
        top = buttonRect.top - tooltipHeight - spacing;
        arrowSide = 'bottom';
      }
      
      // Keep horizontally centered within viewport
      if (left < viewportPadding) {
        left = viewportPadding;
      }
      if (left + tooltipWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - tooltipWidth - viewportPadding;
      }
      
    } else {
      // Use horizontal positioning (original logic)
      // Prefer right side if there's enough space
      if (spaceOnRight >= tooltipWidth + spacing + viewportPadding) {
        // Position to the right
        left = buttonRect.right + spacing;
        arrowSide = 'left';
      } else if (spaceOnLeft >= tooltipWidth + spacing + viewportPadding) {
        // Position to the left
        left = buttonRect.left - tooltipWidth - spacing;
        arrowSide = 'right';
      } else {
        // Not enough space on either side, use the side with more space
        if (spaceOnRight > spaceOnLeft) {
          left = buttonRect.right + spacing;
          arrowSide = 'left';
          // Allow tooltip to go to edge of screen
          if (left + tooltipWidth > window.innerWidth - viewportPadding) {
            left = window.innerWidth - tooltipWidth - viewportPadding;
          }
        } else {
          left = buttonRect.left - tooltipWidth - spacing;
          arrowSide = 'right';
          // Allow tooltip to go to edge of screen
          if (left < viewportPadding) {
            left = viewportPadding;
          }
        }
      }
      
      // Center vertically relative to button
      top = buttonRect.top + (buttonRect.height / 2) - (tooltipHeight / 2);
      
      // Keep tooltip within viewport vertically
      if (top < viewportPadding) {
        top = viewportPadding;
      }
      if (top + tooltipHeight > window.innerHeight - viewportPadding) {
        top = window.innerHeight - tooltipHeight - viewportPadding;
      }
    }
    
    // Apply positioning
    tooltipElement.style.left = left + 'px';
    tooltipElement.style.top = top + 'px';
    
    // Update arrow direction
    const arrow = tooltipElement.querySelector('.tooltip-arrow');
    if (arrow) {
      arrow.className = 'tooltip-arrow ' + arrowSide;
    }
  }
}

function hideTooltip(event, fieldName) {
  const tooltipId = 'tooltip-' + fieldName;
  let tooltipElement = document.getElementById(tooltipId);
  
  if (tooltipElement) {
    tooltipElement.classList.remove('active');
  }
}

// Close tooltip on ESC key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.tooltip-content').forEach(tip => {
      tip.classList.remove('active');
    });
  }
});

// Notify server if window is closed without starting authentication
window.addEventListener('beforeunload', function(e) {
  // Only send cancel if user never started the authentication process
  // (If they started auth, they either completed it or clicked cancel explicitly)
  if (!authenticationStarted) {
    // Use sendBeacon for reliable delivery even as page unloads
    navigator.sendBeacon('/cancel', '');
  }
});

