/**
 * Authentication Hook for eGain MCP Server
 * Handles Azure B2C OAuth2 authentication with PKCE and popup window
 */

import { SDKInitHook, BeforeRequestHook, HookContext } from "./types.js";
import { SDKOptions } from "../lib/config.js";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as http from "http";
import * as os from "os";
import { fileURLToPath } from 'url';
import * as crypto from "crypto";
import { promisify } from "util";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory by finding package.json
const getProjectRoot = (): string => {
  // Start from current directory and walk up until we find package.json
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) { // Stop at filesystem root
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // If package.json not found, use current working directory as fallback
  return process.cwd();
};

// Get user's home directory for storing config securely
const getConfigDir = (): string => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.egain-mcp');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 }); // Only user can read/write
  }
  
  return configDir;
};

const getConfigPath = (): string => {
  return path.join(getConfigDir(), 'config.json');
};

const execAsync = promisify(exec);

interface AuthConfig {
  environmentUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authUrl?: string;
  accessUrl?: string;
  scopePrefix?: string;
}

interface PKCEValues {
  codeVerifier: string;
  codeChallenge: string;
}

const CONFIG_SERVER_PORT = 3333;
const CONFIG_SERVER_HOST = 'localhost';

// Embedded HTML/JS content for auth pages (included in bundle for npm package compatibility)
const CONFIG_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eGain MCP - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Open Sans", "Segoe UI", "SegoeUI", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      background: #fef1fd;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0px 0px 30px 0px rgba(0, 0, 0, 0.12);
      max-width: 500px;
      width: 100%;
      padding: 32px;
    }
    h1 { color: #333; margin-bottom: 8px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 13px; }
    .quick-signin { 
      display: none; 
      text-align: center; 
      position: relative;
    }
    .quick-signin .icon { font-size: 64px; }
    .quick-signin h1 { text-align: center; }
    .saved-config {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      text-align: left;
    }
    .saved-config-title {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 15px;
      text-align: center;
    }
    .config-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e1e4e8;
      font-size: 13px;
    }
    .config-item:last-child { border-bottom: none; }
    .config-label { color: #666; font-weight: 500; }
    .config-value {
      color: #333;
      font-family: 'Courier New', monospace;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .config-value.masked { color: #999; }
    .form-view { display: none; }
    .form-group { margin-bottom: 16px; }
    label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      color: #333;
      font-weight: 500;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border: 2px solid #e1e4e8;
      border-radius: 8px;
      font-size: 13px;
      font-family: "Helvetica Neue LT Pro", "Open Sans", 'Courier New', monospace !important;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #b91d8f;
    }
    .optional {
      color: #999;
      font-weight: normal;
      font-size: 12px;
    }
    .tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      background: #b91d8f;
      color: white;
      border-radius: 50%;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      flex-shrink: 0;
      user-select: none;
    }
    .tooltip-content {
      display: none !important;
      position: fixed;
      max-width: 380px;
      width: max-content;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      overflow: hidden;
      border: 2px solid #b91d8f;
      pointer-events: auto;
    }
    .tooltip-content.active {
      display: block !important;
    }
    .tooltip-arrow {
      position: absolute;
      width: 0;
      height: 0;
      border: 8px solid transparent;
      z-index: 1;
    }
    .tooltip-arrow.left {
      left: -16px;
      top: 50%;
      transform: translateY(-50%);
      border-right-color: #b91d8f;
    }
    .tooltip-arrow.right {
      right: -16px;
      top: 50%;
      transform: translateY(-50%);
      border-left-color: #b91d8f;
    }
    .tooltip-arrow.top {
      top: -16px;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: #b91d8f;
    }
    .tooltip-arrow.bottom {
      bottom: -16px;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: #b91d8f;
    }
    .tooltip-header {
      background: #b91d8f;
      color: white;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 13px;
    }
    .tooltip-body {
      padding: 10px 12px;
    }
    .tooltip-image {
      width: 100%;
      max-height: 200px;
      object-fit: contain;
      border-radius: 4px;
      margin-bottom: 6px;
      border: 1px solid #e1e4e8;
      background: #f8f9fa;
    }
    .tooltip-text {
      color: #555;
      font-size: 12px;
      line-height: 1.4;
      font-style: italic;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    button {
      flex: 1;
      padding: 12px;
      border: 2px solid transparent;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #b91d8f 0%, #7a1460 100%);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(185, 29, 143, 0.4);
    }
    .btn-secondary {
      background: #f6f8fa;
      color: #666;
    }
    .btn-secondary:hover {
      background: #e1e4e8;
    }
    .btn-danger {
      background: white;
      color: #b91d8f;
      border: 2px solid #b91d8f;
    }
    .btn-danger:hover {
      background: #fef1fd;
      transform: translateY(-1px);
    }
    .btn-link {
      background: transparent;
      color: #b91d8f;
      padding: 8px;
      font-size: 14px;
    }
    .btn-link:hover {
      background: #f6f8fa;
    }
    .status {
      margin-top: 20px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status.info {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    /* Loading overlay and spinner */
    .loading-overlay {
      display: none;
      position: absolute;
      top: -32px;
      left: -32px;
      right: -32px;
      bottom: -32px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(2px);
      border-radius: 16px;
      z-index: 1000;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      gap: 16px;
    }
    .loading-overlay.active {
      display: flex;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e1e4e8;
      border-top-color: #b91d8f;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-message {
      color: #666;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      max-width: 300px;
    }
    .form-view {
      position: relative;
    }
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      justify-content: center;
      align-items: center;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }
    .modal-title {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    .modal-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .modal-buttons {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .modal-buttons button {
      padding: 10px 20px;
      font-size: 14px;
      flex: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="quickSigninView" class="quick-signin">
      <div id="loadingOverlayQuickSignin" class="loading-overlay">
        <div class="spinner"></div>
        <div id="loadingMessageQuickSignin" class="loading-message">Redirecting to login...</div>
      </div>
      <div class="icon">🔐</div>
      <h1>Welcome Back!</h1>
      <p class="subtitle">Ready to sign in with your saved configuration</p>
      <div class="saved-config">
        <div class="saved-config-title">Saved Configuration</div>
        <div id="savedConfigList"></div>
      </div>
      <div class="button-group">
        <button type="button" class="btn-danger" onclick="clearConfigAndShowForm()">Clear All</button>
        <button type="button" class="btn-primary" onclick="signInWithSavedConfig()">Sign In</button>
      </div>
      <button type="button" class="btn-link" onclick="showForm()" style="width: 100%; margin-top: 10px;">Edit Configuration</button>
    </div>
    <div id="formView" class="form-view">
      <div id="loadingOverlay" class="loading-overlay">
        <div class="spinner"></div>
        <div id="loadingMessage" class="loading-message">Saving configuration...</div>
      </div>
      <h1>🔐 eGain MCP Configuration</h1>
      <p class="subtitle">Enter details from your eGain <strong>Admin Console</strong></p>
      <form id="configForm">
        <div class="form-group">
          <label for="egainUrl">
            <span>eGain Environment URL</span>
            <span class="tooltip" onmouseenter="showTooltip(event, 'egainUrl')" onmouseleave="hideTooltip(event, 'egainUrl')">?</span>
          </label>
          <input type="text" id="egainUrl" name="egainUrl" placeholder="https://your-environment.egain.cloud" required>
        </div>
        <div class="form-group">
          <label for="authUrl">
            <span>Authorization URL</span>
            <span class="tooltip" onmouseenter="showTooltip(event, 'authUrl')" onmouseleave="hideTooltip(event, 'authUrl')">?</span>
          </label>
          <input type="text" id="authUrl" name="authUrl" placeholder="https://login.egain.cloud/.../oauth2/authorize" required>
        </div>
        <div class="form-group">
          <label for="accessTokenUrl">
            <span>Access Token URL</span>
            <span class="tooltip" onmouseenter="showTooltip(event, 'accessTokenUrl')" onmouseleave="hideTooltip(event, 'accessTokenUrl')">?</span>
          </label>
          <input type="text" id="accessTokenUrl" name="accessTokenUrl" placeholder="https://login.egain.cloud/.../oauth2/token" required>
        </div>
        <div class="form-group">
          <label for="clientId">
            <span>Client ID</span>
            <span class="tooltip" onmouseenter="showTooltip(event, 'clientId')" onmouseleave="hideTooltip(event, 'clientId')">?</span>
          </label>
          <input type="text" id="clientId" name="clientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required>
        </div>
        <div class="form-group">
          <label for="redirectUrl">
            <span>Redirect URL</span>
            <span class="tooltip" onmouseenter="showTooltip(event, 'redirectUrl')" onmouseleave="hideTooltip(event, 'redirectUrl')">?</span>
          </label>
          <input type="text" id="redirectUrl" name="redirectUrl" placeholder="https://your-redirect-url.com/" required>
        </div>
        
        <!-- Advanced Settings Toggle -->
        <div style="margin: 12px 0;">
          <button type="button" onclick="toggleAdvancedSettings()" style="padding: 6px 0; font-size: 13px; display: flex; align-items: center; gap: 6px; background: none; border: none; color: #b91d8f; cursor: pointer; font-family: inherit;">
            <span id="advancedToggleIcon">▶</span>
            <span>Advanced Settings</span>
            <span style="color: #999; font-size: 11px;">(optional)</span>
          </button>
        </div>
        
        <!-- Advanced Settings Section (hidden by default) -->
        <div id="advancedSettings" style="display: none;">
          <div class="form-group">
            <label for="clientSecret">
              <span>Client Secret</span>
              <span class="tooltip" onmouseenter="showTooltip(event, 'clientSecret')" onmouseleave="hideTooltip(event, 'clientSecret')">?</span>
              <span class="optional">(optional)</span>
            </label>
            <input type="password" id="clientSecret" name="clientSecret" placeholder="Required for normal authentication flow/non-PKCE">
          </div>
          <div class="form-group">
            <label for="scopePrefix">
              <span>Scope Prefix</span>
              <span class="tooltip" onmouseenter="showTooltip(event, 'scopePrefix')" onmouseleave="hideTooltip(event, 'scopePrefix')">?</span>
              <span class="optional">(optional)</span>
            </label>
            <input type="text" id="scopePrefix" name="scopePrefix" placeholder="https://your.scope-prefix.cloud/auth/">
          </div>
        </div>
        <div style="font-size: 11px; color: #999; margin: 12px 0 0 0; line-height: 1.4;">
          🔒 Your configuration will be securely saved to your <code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 10px;">~/.egain-mcp/config.json</code>.
        </div>
        <div class="button-group">
          <button type="button" class="btn-secondary" onclick="cancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save & Authenticate</button>
        </div>
      </form>
    </div>
    <div id="status" class="status"></div>
  </div>
  
  <!-- Confirmation Modal -->
  <div id="confirmModal" class="modal-overlay" onclick="if(event.target === this) closeModal(false)">
    <div class="modal-content">
      <div class="modal-title" id="modalTitle">Confirm Action</div>
      <div class="modal-message" id="modalMessage">Are you sure?</div>
      <div class="modal-buttons">
        <button type="button" class="btn-secondary" onclick="closeModal(false)">Cancel</button>
        <button type="button" class="btn-danger" id="modalConfirmBtn" onclick="closeModal(true)">Confirm</button>
      </div>
    </div>
  </div>
  
  <!-- Tooltip Popups (outside container for proper fixed positioning) -->
  <div id="tooltip-egainUrl" class="tooltip-content">
    <div class="tooltip-header">eGain Environment URL</div>
    <div class="tooltip-body">
      <img src="/img/env-tooltip.png" class="tooltip-image" alt="eGain Environment URL" onerror="this.style.display='none'">
      <div class="tooltip-text">Enter the domain URL displayed in your browser when accessing the eGain application.</div>
    </div>
  </div>
  
  <div id="tooltip-authUrl" class="tooltip-content">
    <div class="tooltip-header">Authorization URL</div>
    <div class="tooltip-body">
      <img src="/img/authurl-tooltip.png" class="tooltip-image" alt="Authorization URL" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application → Metadata, and copy the Authorization URL.</div>
    </div>
  </div>
  
  <div id="tooltip-accessTokenUrl" class="tooltip-content">
    <div class="tooltip-header">Access Token URL</div>
    <div class="tooltip-body">
      <img src="/img/accesstoken-tooltip.png" class="tooltip-image" alt="Access Token URL" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application → Metadata, and copy the Access Token URL.</div>
    </div>
  </div>
  
  <div id="tooltip-clientId" class="tooltip-content">
    <div class="tooltip-header">Client ID</div>
    <div class="tooltip-body">
      <img src="/img/clientid-tooltip.png" class="tooltip-image" alt="Client ID" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application, select your client app, and copy the Client ID.</div>
    </div>
  </div>
  
  <div id="tooltip-redirectUrl" class="tooltip-content">
    <div class="tooltip-header">Redirect URL</div>
    <div class="tooltip-body">
      <img src="/img/redirect-tooltip.png" class="tooltip-image" alt="Redirect URL" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application, select your client app, and copy the Redirect URL.</div>
    </div>
  </div>
  
  <div id="tooltip-clientSecret" class="tooltip-content">
    <div class="tooltip-header">Client Secret</div>
    <div class="tooltip-body">
      <img src="/img/clientsecret-tooltip.png" class="tooltip-image" alt="Client Secret" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application, select your client app, and copy the Client Secret under Secrets.</div>
    </div>
  </div>
  
  <div id="tooltip-scopePrefix" class="tooltip-content">
    <div class="tooltip-header">Scope Prefix</div>
    <div class="tooltip-body">
      <img src="/img/scopeprefix-tooltip.png" class="tooltip-image" alt="Scope Prefix" onerror="this.style.display='none'">
      <div class="tooltip-text">In the Partition space, go to Integration → Client Application → Metadata, and copy the API Permission Prefix.</div>
    </div>
  </div>
  
  <script src="/config-page.js"></script>
</body>
</html>`;

const CONFIG_PAGE_JS = `const FIELDS = ['egainUrl', 'authUrl', 'accessTokenUrl', 'clientId', 'redirectUrl', 'clientSecret', 'scopePrefix'];
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
});`;

const SAFARI_WARNING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safari Not Supported - eGain MCP</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: "Open Sans", "Segoe UI", "SegoeUI", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      background: #fef1fd;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0px 0px 30px 0px rgba(0, 0, 0, 0.12);
      max-width: 500px;
      width: 100%;
      padding: 32px;
      text-align: center;
    }
    
    .warning-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    
    h1 {
      color: #e74c3c;
      font-size: 28px;
      margin-bottom: 30px;
      font-weight: 600;
    }
    
    .reason {
      background: #fff0f6;
      border-left: 4px solid #d946a6;
      padding: 20px;
      text-align: left;
      border-radius: 4px;
    }
    
    .reason strong {
      color: #a21361;
      display: block;
      margin-bottom: 12px;
      font-size: 16px;
    }
    
    .reason p {
      color: #a21361;
      font-size: 14px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="warning-icon">⚠️</div>
    <h1>Safari Not Supported</h1>
    
    <div class="reason">
      <strong>Why?</strong>
      <p>
        Safari doesn't support private browsing mode via command line, which is required 
        to protect your OAuth credentials from being cached or leaked. We prioritize your 
        security over convenience.
      </p>
    </div>
  </div>
</body>
</html>`;

export class AuthenticationHook implements SDKInitHook, BeforeRequestHook {
  private token: string | null = null;
  private authConfig: AuthConfig;
  private codeVerifier: string;
  private codeChallenge: string;
  private portalCacheHook?: any; // PortalCacheHook reference
  private configServer: http.Server | null = null; // HTTP server for configuration form
  private detectedBrowser: string = 'Google Chrome'; // Default fallback
  private authCancelled: boolean = false; // Track if user cancelled authentication
  private oauthRedirectStarted: boolean = false; // Track when OAuth redirect happens


  /**
   * Generates PKCE (Proof Key for Code Exchange) values for OAuth2 security
   * @returns Object containing code verifier and S256 code challenge
   */
  private generatePKCEValues(): PKCEValues {
    // Generate cryptographically secure random code verifier (43-128 characters)
    // Using base64url encoding of 32 random bytes = 43 characters
    const codeVerifier = crypto
      .randomBytes(32)
      .toString('base64url'); // base64url automatically removes padding and uses URL-safe characters
    
    // Generate S256 code challenge from verifier
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url'); // base64url encoding for URL safety
    
    console.error('🔐 Generated new PKCE values:');
    console.error(`   Code Verifier: ${codeVerifier.substring(0, 10)}... (${codeVerifier.length} chars)`);
    console.error(`   Code Challenge: ${codeChallenge.substring(0, 10)}... (${codeChallenge.length} chars)`);
    
    return {
      codeVerifier,
      codeChallenge
    };
  }

  constructor(portalCacheHook?: any) {
    this.portalCacheHook = portalCacheHook;
    this.authConfig = this.loadAuthConfig();
    
    // Generate secure PKCE values instead of using hardcoded ones
    const pkceValues = this.generatePKCEValues();
    this.codeVerifier = pkceValues.codeVerifier;
    this.codeChallenge = pkceValues.codeChallenge;
  }

  /**
   * Detect the default browser on macOS or Windows
   */
  private async detectDefaultBrowser(): Promise<void> {
    console.error('🔍 Attempting to detect default browser...');
    
    const platform = process.platform;
    
    // Force specific browser for testing if FORCE_BROWSER env var is set
    const forcedBrowser = process.env['FORCE_BROWSER'] || (process.env['FORCE_SAFARI_BROWSER'] === 'true' ? 'Safari' : null);
    if (forcedBrowser) {
      console.error(`   🧪 TEST MODE: Forcing ${forcedBrowser} browser...`);
      this.detectedBrowser = forcedBrowser;
      
      if (forcedBrowser === 'Safari') {
        console.error(`⚠️  Found Safari, but it has limited private browsing support via CLI`);
        console.error(`   For better security, consider installing Chrome, Firefox, or Edge`);
      } else {
        console.error(`✅ Using ${forcedBrowser} for testing`);
      }
      return;
    }
    
    if (platform === 'darwin') {
      await this.detectBrowserMacOS();
    } else if (platform === 'win32') {
      await this.detectBrowserWindows();
    }
  }

  /**
   * Detect browser on macOS
   */
  private async detectBrowserMacOS(): Promise<void> {
    // Map bundle IDs to application names
    const browserMap: { [key: string]: string } = {
      'com.google.chrome': 'Google Chrome',
      'com.apple.safari': 'Safari',
      'org.mozilla.firefox': 'Firefox',
      'com.microsoft.edgemac': 'Microsoft Edge',
      'com.brave.browser': 'Brave Browser',
      'com.vivaldi.vivaldi': 'Vivaldi',
      'com.operasoftware.opera': 'Opera'
    };
    
    // Method 1: Try using defaultbrowser command (if installed)
    try {
      console.error('   Method 1: Trying defaultbrowser command...');
      const { stdout } = await execAsync('which defaultbrowser');
      if (stdout.trim()) {
        const { stdout: browserOutput } = await execAsync('defaultbrowser');
        const bundleId = browserOutput.trim();
        console.error(`   Bundle ID from defaultbrowser: ${bundleId}`);
        
        if (bundleId && browserMap[bundleId]) {
          this.detectedBrowser = browserMap[bundleId];
          console.error(`✅ Successfully detected: ${this.detectedBrowser}`);
          return;
        }
      }
    } catch (error) {
      console.error('   Method 1 failed (defaultbrowser not installed)');
    }
    
    // Method 2: Check LaunchServices
    try {
      console.error('   Method 2: Checking LaunchServices...');
      const { stdout } = await execAsync(`defaults read com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers 2>/dev/null | grep -B 1 -A 3 'https' | grep LSHandlerRoleAll -A 2 | grep LSHandlerContentTag | head -1 | cut -d '"' -f 2`);
      const bundleId = stdout.trim();
      console.error(`   Bundle ID from LaunchServices: ${bundleId || '(none)'}`);
      
      if (bundleId && browserMap[bundleId]) {
        this.detectedBrowser = browserMap[bundleId];
        console.error(`✅ Successfully detected: ${this.detectedBrowser}`);
        return;
      }
    } catch (error) {
      console.error('   Method 2 failed');
    }
    
    // Method 3: Scan for installed browsers
    console.error('   Method 3: Scanning for installed browsers...');
    const browsersToCheck = [
      'Google Chrome',
      'Microsoft Edge',
      'Firefox',
      'Brave Browser',
      'Vivaldi',
      'Opera',
      'Safari'
    ];
    
    for (const browser of browsersToCheck) {
      try {
        await execAsync(`osascript -e 'exists application "${browser}"'`);
        this.detectedBrowser = browser;
        
        if (browser === 'Safari') {
          console.error(`⚠️  Found Safari, but it has limited private browsing support via CLI`);
          console.error(`   For better security, consider installing Chrome, Firefox, or Edge`);
        } else {
          console.error(`✅ Found installed browser: ${this.detectedBrowser}`);
        }
        return;
      } catch (error) {
        // Browser not installed, continue
      }
    }
    
    console.error(`⚠️  No browsers detected, falling back to: ${this.detectedBrowser}`);
  }

  /**
   * Detect browser on Windows
   */
  private async detectBrowserWindows(): Promise<void> {
    console.error('   Method 1: Checking Windows registry for default browser...');
    
    // Try to get default browser from Windows registry
    try {
      const { stdout } = await execAsync(
        `powershell -Command "$browser = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice' -ErrorAction SilentlyContinue).ProgId; Write-Output $browser"`
      );
      
      const progId = stdout.trim().toLowerCase();
      console.error(`   ProgID detected: ${progId || '(none)'}`);
      
      // Map Windows ProgIDs to browser names
      if (progId.includes('chromehtml')) {
        this.detectedBrowser = 'chrome';
        console.error(`✅ Successfully detected: Google Chrome`);
        return;
      } else if (progId.includes('msedgehtm')) {
        this.detectedBrowser = 'msedge';
        console.error(`✅ Successfully detected: Microsoft Edge`);
        return;
      } else if (progId.includes('firefox')) {
        this.detectedBrowser = 'firefox';
        console.error(`✅ Successfully detected: Firefox`);
        return;
      } else if (progId.includes('bravehtml')) {
        this.detectedBrowser = 'brave';
        console.error(`✅ Successfully detected: Brave`);
        return;
      }
    } catch (error) {
      console.error('   Method 1 failed');
    }
    
    // Method 2: Scan for installed browsers in common locations
    console.error('   Method 2: Scanning for installed browsers...');
    const browsersToCheck = [
      { name: 'chrome', paths: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ]},
      { name: 'msedge', paths: [
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ]},
      { name: 'firefox', paths: [
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
      ]},
      { name: 'brave', paths: [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ]}
    ];
    
    for (const browser of browsersToCheck) {
      for (const browserPath of browser.paths) {
        try {
          // Check if file exists using PowerShell
          const { stdout } = await execAsync(
            `powershell -Command "Test-Path '${browserPath}'"`
          );
          
          if (stdout.trim().toLowerCase() === 'true') {
            this.detectedBrowser = browser.name;
            const displayName = browser.name === 'msedge' ? 'Microsoft Edge' : 
                               browser.name === 'chrome' ? 'Google Chrome' :
                               browser.name === 'firefox' ? 'Firefox' : 'Brave';
            console.error(`✅ Found installed browser: ${displayName}`);
            return;
          }
        } catch (error) {
          // Continue checking other paths
        }
      }
    }
    
    // Default to Edge (ships with Windows 10+)
    console.error(`⚠️  No browsers detected, falling back to: Microsoft Edge`);
    this.detectedBrowser = 'msedge';
  }

  /**
   * Get incognito flag for the detected browser
   */
  private getIncognitoFlag(): string {
    const flagMap: { [key: string]: string } = {
      // macOS browser names
      'Google Chrome': '--incognito',
      'Brave Browser': '--incognito',
      'Microsoft Edge': '--inprivate',
      'Vivaldi': '--incognito',
      'Opera': '--private',
      'Firefox': '--private-window',
      'Safari': '', // Safari doesn't support private browsing via CLI well
      // Windows browser executable names
      'chrome': '--incognito',
      'msedge': '--inprivate',
      'firefox': '--private-window',
      'brave': '--incognito'
    };
    
    // Use 'in' operator to check if key exists, allowing empty string values
    if (this.detectedBrowser in flagMap) {
      return flagMap[this.detectedBrowser]!; // Non-null assertion since we just checked
    }
    return '--incognito';
  }


  /**
   * Save OAuth config to user's home directory (secure file storage)
   */
  private saveConfigToFile(config: AuthConfig): void {
    try {
      const configPath = getConfigPath();
      
      // Set restrictive permissions (only current user can read/write)
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { 
        mode: 0o600 
      });
      
      console.error(`💾 Created config file: ${configPath}`);
      console.error('   (Secured with user-only read/write permissions)');
    } catch (error) {
      console.error('❌ Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Load OAuth config from user's home directory, falling back to .env
   */
  private loadAuthConfig(): AuthConfig {
    // Priority 1: Try loading from secure user config file
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent) as AuthConfig;
        console.error(`✅ Loaded config from: ${configPath}`);
        return config;
      }
    } catch (error) {
      console.error('⚠️  Could not load config from home directory:', error);
    }

    // Priority 2: Try loading from .env file (for development)
    try {
      // Try multiple possible locations for the .env file
      const possiblePaths = [
        path.join(process.cwd(), '.env'),
        path.join(__dirname, '../../../.env'), // From compiled esm location in bin/
        path.join(__dirname, '../../../../.env'), // From compiled bin/ to project root
        path.join(__dirname, '../../.env'),    // From src location
        // Try finding project root by looking for package.json
        ...this.findProjectRoot().map(root => path.join(root, '.env'))
      ];
      
      
      let envPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          envPath = possiblePath;
          console.error(`✅ Found .env file at: ${envPath}`);
          break;
        }
      }
      
      if (envPath) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const config: AuthConfig = {};
        
        envContent.split('\n').forEach(line => {
          const equalIndex = line.indexOf('=');
          if (equalIndex > 0) {
            const key = line.substring(0, equalIndex).trim();
            const value = line.substring(equalIndex + 1).trim();
            
            if (key && value) {
              const cleanKey = key;
              const cleanValue = value.replace(/['"]/g, '');
            
              switch (cleanKey) {
                // New variable names (preferred)
                case 'EGAIN_URL':
                  config.environmentUrl = cleanValue;
                  break;
                case 'CLIENT_ID':
                  config.clientId = cleanValue;
                  break;
                case 'CLIENT_SECRET':
                  config.clientSecret = cleanValue;
                  break;
                case 'REDIRECT_URL':
                  config.redirectUri = cleanValue;
                  break;
                case 'AUTH_URL':
                  config.authUrl = cleanValue;
                  break;
                case 'ACCESS_TOKEN_URL':
                  config.accessUrl = cleanValue;
                  break;
                case 'SCOPE_PREFIX':
                  config.scopePrefix = cleanValue;
                  break;
                
                // Backward compatibility with old names
                case 'EGAIN_ENVIRONMENT_URL':
                  config.environmentUrl = cleanValue;
                  break;
                case 'EGAIN_CLIENT_ID':
                  config.clientId = cleanValue;
                  break;
                case 'EGAIN_CLIENT_SECRET':
                  config.clientSecret = cleanValue;
                  break;
                case 'EGAIN_REDIRECT_URI':
                  config.redirectUri = cleanValue;
                  break;
                case 'ACCESS_URL':
                  config.accessUrl = cleanValue;
                  break;
                case 'EGAIN_SCOPE_PREFIX':
                  config.scopePrefix = cleanValue;
                  break;
              }
            }
          }
        });
        
        return config;
      }
    } catch (error) {
      console.error('Could not load .env file');
    }
    
    return {};
  }

  /**
   * Generate Safari warning page (Safari doesn't support private browsing via CLI)
   */
  private getSafariWarningPage(): string {
    // Use embedded content first (works in npm package)
    if (SAFARI_WARNING_HTML) {
      return SAFARI_WARNING_HTML;
    }
    
    // Fallback to file reading for development
    try {
      const projectRoot = getProjectRoot();
      const htmlPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'safari-warning.html');
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load Safari warning page:', error);
      // Fallback minimal HTML
      return '<html><body><h1>Safari Not Supported</h1><p>Safari does not support private browsing mode via command line.</p></body></html>';
    }
  }

  /**
   * Load HTML page for browser-based configuration
   */
  private getConfigPage(): string {
    // Use embedded content first (works in npm package)
    if (CONFIG_PAGE_HTML) {
      return CONFIG_PAGE_HTML;
    }
    
    // Fallback to file reading for development
    try {
      const projectRoot = getProjectRoot();
      const htmlPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.html');
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load config page:', error);
      // Fallback minimal HTML
      return '<html><body><h1>Configuration Error</h1><p>Could not load configuration page.</p></body></html>';
    }
  }

  /**
   * Serve JavaScript for config page
   */
  private getConfigPageJS(): string {
    // Use embedded content first (works in npm package)
    if (CONFIG_PAGE_JS) {
      return CONFIG_PAGE_JS;
    }
    
    // Fallback to file reading for development
    try {
      const projectRoot = getProjectRoot();
      const jsPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.js');
      return fs.readFileSync(jsPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load config page JS:', error);
      return ''; // Return empty string if JS fails to load
    }
  }

  private buildAuthUrl(): string {
    const { environmentUrl, clientId, redirectUri, authUrl, scopePrefix } = this.authConfig;
    
    console.error('🔧 Building OAuth URL...');
    
    if (!authUrl) {
      throw new Error('Authorization URL is required');
    }
    
    // Clean and validate redirect_uri (must match exactly what's registered)
    const cleanRedirectUri = redirectUri?.trim();
    if (!cleanRedirectUri) {
      throw new Error('Redirect URI is required');
    }
    
    // Log the redirect URI for debugging
    console.error('🔗 Redirect URI:', cleanRedirectUri);
    console.error('⚠️  Make sure this EXACTLY matches the redirect URI in your client application (including trailing slashes)');
    
    // Parse the authUrl to remove any existing domain_hint parameter
    let baseUrl = authUrl;
    let existingParams = new URLSearchParams();
    
    // Check if authUrl already has query parameters
    const urlParts = authUrl.split('?');
    if (urlParts.length > 1 && urlParts[0]) {
      baseUrl = urlParts[0];
      const queryString = urlParts.slice(1).join('?'); // Handle multiple ? characters
      existingParams = new URLSearchParams(queryString);
      
      // Remove domain_hint if it exists (we'll add our own)
      if (existingParams.has('domain_hint')) {
        existingParams.delete('domain_hint');
        console.error('🔧 Removed existing domain_hint from authorization URL');
      }
    }
    
    const prefix = scopePrefix || '';
    const scope = `${prefix}knowledge.portalmgr.manage ${prefix}knowledge.portalmgr.read ${prefix}core.aiservices.read`;
    
    // Add our parameters
    existingParams.set('domain_hint', environmentUrl!.trim());
    existingParams.set('client_id', clientId!.trim());
    existingParams.set('response_type', 'code');
    existingParams.set('redirect_uri', cleanRedirectUri);
    existingParams.set('scope', scope);
    existingParams.set('forceLogin', 'yes');
    existingParams.set('prompt', 'login');
    
    // Add PKCE only for public clients (no client_secret)
    // SSO/confidential clients use client_secret only (no PKCE)
    if (!this.authConfig.clientSecret) {
      existingParams.set('code_challenge', this.codeChallenge);
      existingParams.set('code_challenge_method', 'S256');
      console.error('🔐 Using PKCE flow (public client)');
    } else {
      console.error('🔐 Using SSO/confidential client flow (no PKCE)');
    }
    
    // Reconstruct the full URL
    const fullUrl = `${baseUrl}?${existingParams.toString()}`;
    return fullUrl;
  }

  /**
   * Monitor browser window for authorization code in URL
   * Works with ANY redirect URL - detects when URL contains code= parameter
   */
  private async monitorBrowserForAuthCode(): Promise<string> {
    const platform = process.platform;
    const timeout = 120; // 2 minutes
    const startTime = Date.now();
    
    if (platform === 'darwin') {
      // macOS - Monitor using AppleScript
      console.error(`🔍 Monitoring ${this.detectedBrowser} for authorization code...`);
      let lastUrl = '';
      
      while ((Date.now() - startTime) < timeout * 1000) {
        try {
          // Get URL from browser using AppleScript
          const script = `
            tell application "${this.detectedBrowser}"
              try
                set currentURL to URL of active tab of front window
                return currentURL
              on error
                return ""
              end try
            end tell
          `;
          
          const { stdout } = await execAsync(`osascript -e '${script}'`);
          const currentUrl = stdout.trim();
          
          if (currentUrl && currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.error(`🔍 Current URL: ${currentUrl}`);
          }
          
          // Check if URL contains code= parameter (regardless of domain)
          if (currentUrl && currentUrl.includes('code=')) {
            console.error('✅ Found authorization code in URL!');
            
            // Extract the code from the URL
            const codeMatch = currentUrl.match(/[?&]code=([^&]+)/);
            if (codeMatch && codeMatch[1]) {
              const code = decodeURIComponent(codeMatch[1]);
              console.error(`🔑 Extracted authorization code (first 20 chars): ${code.substring(0, 20)}...`);
              console.error(`   Code length: ${code.length} characters`);
              
              // Close the browser window immediately (non-blocking - fire and forget)
              setImmediate(async () => {
                try {
                  await execAsync(`osascript -e 'tell application "${this.detectedBrowser}" to close front window'`);
                  console.error('✅ Browser window closed');
                } catch (closeError) {
                  console.error('⚠️  Could not close browser window:', closeError);
                }
              });
              
              // Return code immediately without waiting for window close
              return code;
            }
          }
          
          // Also check for error parameters
          if (currentUrl && currentUrl.includes('error=')) {
            const errorMatch = currentUrl.match(/[?&]error=([^&]+)/);
            const errorDescMatch = currentUrl.match(/error_description=([^&]+)/);
            const error = errorMatch && errorMatch[1] ? decodeURIComponent(errorMatch[1]) : 'unknown_error';
            const errorDesc = errorDescMatch && errorDescMatch[1] ? decodeURIComponent(errorDescMatch[1]) : 'No description';
            
            // Throw OAuth error - this will stop monitoring but window stays open so user can see the error
            throw new Error(`OAuth error: ${error} - ${errorDesc}`);
          }
          
        } catch (error) {
          // Re-throw OAuth errors (they should stop monitoring but window stays open)
          if (error instanceof Error && error.message.includes('OAuth error:')) {
            throw error;
          }
          // Ignore AppleScript errors and continue monitoring
        }
        
        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      throw new Error('Authentication timeout. Please try again.');
      
    } else if (platform === 'win32') {
      // Windows - Monitor browser window title (contains URL in most browsers)
      console.error(`🔍 Monitoring ${this.detectedBrowser} for authorization code...`);
      let lastTitle = '';
      
      while ((Date.now() - startTime) < timeout * 1000) {
        try {
          // PowerShell script to get browser window title
          // Window titles often contain the URL or page title
          const browserProcessName = this.detectedBrowser.replace('.exe', '');
          const psScript = `
            $process = Get-Process -Name "${browserProcessName}" -ErrorAction SilentlyContinue | 
              Where-Object { $_.MainWindowHandle -ne 0 } | 
              Select-Object -First 1
            if ($process) {
              $process.MainWindowTitle
            }
          `.replace(/\n\s+/g, ' ');
          
          const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
          const windowTitle = stdout.trim();
          
          if (windowTitle && windowTitle !== lastTitle) {
            lastTitle = windowTitle;
            console.error(`🔍 Browser window: ${windowTitle.substring(0, 100)}...`);
            
            // Check if title or URL contains the code parameter
            // Most browsers show URL in the title or we can detect redirect completion
            if (windowTitle.includes('code=') || windowTitle.includes('localhost:3333')) {
              console.error('✅ Detected OAuth callback!');
              
              // Try to extract code from title if visible
              const codeMatch = windowTitle.match(/code=([^&\s]+)/);
              if (codeMatch && codeMatch[1]) {
                const code = decodeURIComponent(codeMatch[1]);
                console.error(`🔑 Extracted authorization code (first 20 chars): ${code.substring(0, 20)}...`);
                console.error(`   Code length: ${code.length} characters`);
                
                // Close browser window immediately (non-blocking - fire and forget)
                setImmediate(async () => {
                  try {
                    await execAsync(`powershell -Command "Stop-Process -Name '${browserProcessName}' -Force"`);
                    console.error('✅ Browser window closed');
                  } catch (closeError) {
                    console.error('⚠️  Could not close browser window:', closeError);
                  }
                });
                
                // Return code immediately without waiting for window close
                return code;
              }
            }
            
            // Check for OAuth error in title
            if (windowTitle.includes('error=')) {
              const errorMatch = windowTitle.match(/error=([^&\s]+)/);
              const error = errorMatch && errorMatch[1] ? decodeURIComponent(errorMatch[1]) : 'unknown_error';
              // Throw OAuth error - this will stop monitoring but window stays open so user can see the error
              throw new Error(`OAuth error: ${error}`);
            }
          }
          
        } catch (error) {
          // Re-throw OAuth errors (they should stop monitoring but window stays open)
          if (error instanceof Error && error.message.includes('OAuth error:')) {
            throw error;
          }
          // Ignore other errors and continue monitoring
        }
        
        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      throw new Error('Authentication timeout. The browser window title did not show the authorization code. Please ensure your redirect URL is http://localhost:3333/callback for automatic detection on Windows.');
      
    } else {
      throw new Error('Linux is not supported. Use macOS or Windows for automatic authentication.');
    }
  }

  private async getUserAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUri, accessUrl } = this.authConfig;
    
    console.error('🔄 Starting token exchange...');
    
    // Warn if Access Token URL doesn't look like a token endpoint
    if (accessUrl && !accessUrl.toLowerCase().includes('token')) {
      console.error('⚠️  WARNING: Access Token URL does not contain "token" - verify this is correct!');
    }
    
    // Temporarily disable SSL verification for development/testing
    // This is a workaround for corporate networks or certificate issues
    const originalRejectUnauthorized = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      // SSO/Confidential client flow: Use client_secret only (no PKCE)
      // Public client flow: Use PKCE with code_verifier (no client_secret)
      if (clientSecret) {
        console.error('🔄 Using SSO/confidential client flow (client_secret only, no PKCE)...');
        
        const confidentialClientBody = new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri!,
          client_id: clientId!,
          client_secret: clientSecret
        });
        
        const confidentialResponse = await fetch(accessUrl!, {
          method: 'POST',
          headers,
          body: confidentialClientBody
        });

        console.error('📨 Token response received (confidential client):', confidentialResponse.status, confidentialResponse.statusText);

        if (confidentialResponse.ok) {
          const data = await confidentialResponse.json() as { access_token?: string; expires_in?: number };
          
          if (data.access_token) {
            console.error('✅ Token received (confidential client)');
            await this.saveTokenWithExpiration(data.access_token, data.expires_in);
            return data.access_token;
          } else {
            throw new Error('No access_token in confidential client response');
          }
        } else {
          const errorText = await confidentialResponse.text();
          console.error('❌ Confidential client failed:', confidentialResponse.status);
          throw new Error(`Token request failed: ${confidentialResponse.status} - ${errorText}`);
        }
      } else {
        // Public client flow: Use PKCE with code_verifier
        console.error('🔄 Using public client flow (PKCE with code_verifier)...');
        
        const publicClientBody = new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri!,
          client_id: clientId!,
          code_verifier: this.codeVerifier
        });
        
        const publicResponse = await fetch(accessUrl!, {
          method: 'POST',
          headers,
          body: publicClientBody
        });

        console.error('📨 Token response received (public client):', publicResponse.status, publicResponse.statusText);

        if (publicResponse.ok) {
          const data = await publicResponse.json() as { access_token?: string; expires_in?: number };
          
          if (data.access_token) {
            console.error('✅ Token received (public client)');
            await this.saveTokenWithExpiration(data.access_token, data.expires_in);
            return data.access_token;
          } else {
            throw new Error('No access_token in public client response');
          }
        } else {
          const errorText = await publicResponse.text();
          console.error('❌ Public client failed:', publicResponse.status);
          throw new Error(`Token request failed (public client): ${publicResponse.status} - ${errorText}`);
        }
      }
      
    } catch (error) {
      console.error('💥 Token exchange error:', error);
      throw new Error(`Error getting user access token: ${error}`);
    } finally {
      // Restore original SSL setting
      if (originalRejectUnauthorized !== undefined) {
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalRejectUnauthorized;
      } else {
        delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
      }
    }
  }


  private async saveToken(token: string): Promise<void> {
    try {
      // Save to the project root directory (not current working directory)
      const projectRoot = getProjectRoot();
      const tokenPath = path.join(projectRoot, '.bearer_token');
      
      try {
        fs.writeFileSync(tokenPath, token);
        console.error(`💾 Access token saved to ${tokenPath}`);
      } catch (error) {
        console.error(`❌ Failed to save token to ${tokenPath}:`, error);
        throw error;
      }
    } catch (error) {
      console.error('Could not save token:', error);
      throw error;
    }
  }

  /**
   * Saves token with expiration metadata for fast validation
   * @param token The bearer token
   * @param expiresIn Expiration time in seconds (from OAuth2 response)
   */
  private async saveTokenWithExpiration(token: string, expiresIn?: number): Promise<void> {
    try {
      const now = Date.now();
      const expirationTime = expiresIn ? now + (expiresIn * 1000) : now + (3600 * 1000);
      
      const tokenData = {
        token,
        expiresAt: expirationTime,
        createdAt: now
      };
      
      const projectRoot = getProjectRoot();
      const tokenPath = path.join(projectRoot, '.bearer_token');
      const metadataPath = path.join(projectRoot, '.bearer_token_metadata');
      
      try {
        fs.writeFileSync(tokenPath, token);
        fs.writeFileSync(metadataPath, JSON.stringify(tokenData, null, 2));
        console.error(`💾 Token saved (expires: ${new Date(expirationTime).toLocaleString()})`);
      } catch (error) {
        await this.saveToken(token);
      }
    } catch (error) {
      await this.saveToken(token);
    }
  }

  /**
   * Checks if the stored token is expired without making API calls
   * @returns true if token is valid, false if expired or not found
   */
  private isTokenValid(): boolean {
    try {
      const projectRoot = getProjectRoot();
      const metadataPath = path.join(projectRoot, '.bearer_token_metadata');
      
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        const tokenData = JSON.parse(metadataContent);
        const timeUntilExpiry = tokenData.expiresAt - Date.now();
        
        if (timeUntilExpiry > 60000) { // Valid if more than 1 minute left
          return true;
        } else {
          console.error(`⏰ AUTH: Token expires in ${Math.round(timeUntilExpiry / 1000)} seconds - treating as expired`);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  // Force login mechanism removed - use `npm run logout` instead

  private loadExistingToken(): string | null {
    try {
      // Check in the project root directory (not current working directory)
      const projectRoot = getProjectRoot();
      const tokenPath = path.join(projectRoot, '.bearer_token');
      
      if (fs.existsSync(tokenPath)) {
        const token = fs.readFileSync(tokenPath, 'utf8').trim();
        if (token && token.length > 10) { // Basic validation
          console.error(`🔑 Found existing bearer token at: ${tokenPath}`);
          return token;
        }
      }
    } catch (error) {
      console.error('Could not load existing token:', error);
    }
    return null;
  }

  /**
   * Clear the stored bearer token (for remote clearing)
   */
  public clearToken(): void {
    try {
      const projectRoot = getProjectRoot();
      const tokenPath = path.join(projectRoot, '.bearer_token');
      const metadataPath = path.join(projectRoot, '.bearer_token_metadata');
      
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        console.error('🗑️  Deleted bearer token file');
      }
      
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.error('🗑️  Deleted bearer token metadata file');
      }
      
      this.token = null;
      console.error('✅ Token cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear token:', error);
      throw error;
    }
  }

  /**
   * Start the configuration HTTP server
   */
  private async startConfigServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.configServer) {
        console.error('⚠️  Config server already running');
        resolve();
        return;
      }

      console.error(`🌐 Starting configuration server on http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}`);

      this.configServer = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}`);
        
        // Serve static images
        if (url.pathname && url.pathname.startsWith('/img/')) {
          // Images are in the source directory, not the compiled output
          const projectRoot = getProjectRoot();
          const imagePath = path.join(projectRoot, 'src', 'hooks', url.pathname);
          try {
            const imageData = fs.readFileSync(imagePath);
            const ext = path.extname(imagePath).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(imageData);
            return;
          } catch (error) {
            console.error(`❌ Image not found: ${imagePath}`, error);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Image not found');
            return;
          }
        }
        
        // Serve config page JavaScript
        if (url.pathname === '/config-page.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(this.getConfigPageJS());
          return;
        }
        
        // Serve configuration page
        if (url.pathname === '/' || url.pathname === '/config') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getConfigPage());
          return;
        }
        
        // Serve Safari warning page
        if (url.pathname === '/safari-warning') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getSafariWarningPage());
          return;
        }
        
        // Get saved configuration
        if (url.pathname === '/get-config' && req.method === 'GET') {
          try {
            // Check if we have a valid config (at least the required fields)
            const hasValidConfig = this.authConfig.environmentUrl && 
                                  this.authConfig.clientId && 
                                  this.authConfig.authUrl && 
                                  this.authConfig.accessUrl && 
                                  this.authConfig.redirectUri;
            
            if (!hasValidConfig) {
              // No config exists
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ config: null }));
              return;
            }
            
            // Return current authConfig (loaded from file or .env)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              config: {
                egainUrl: this.authConfig.environmentUrl,
                authUrl: this.authConfig.authUrl,
                accessTokenUrl: this.authConfig.accessUrl,
                clientId: this.authConfig.clientId,
                redirectUrl: this.authConfig.redirectUri,
                clientSecret: this.authConfig.clientSecret,
                scopePrefix: this.authConfig.scopePrefix
              }
            }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        
        // Get OAuth URL for saved config (used when signing in with existing config)
        if (url.pathname === '/get-oauth-url' && req.method === 'POST') {
          try {
            const oauthUrl = this.buildAuthUrl();
            console.error('🔐 Generated OAuth URL for saved configuration');
            console.error('🔗 OAuth URL:', oauthUrl);
            
            // Mark that OAuth redirect is about to happen (shorter timeout applies)
            this.oauthRedirectStarted = true;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true,
              oauthUrl: oauthUrl
            }));
            
            // Start monitoring browser in background (for ANY redirect URL)
            console.error('🔍 Starting browser URL monitoring for authorization code...');
            setImmediate(async () => {
              try {
                const code = await this.monitorBrowserForAuthCode();
                console.error('✅ Authorization code detected:', code.substring(0, 10) + '...');
                
                const accessToken = await this.getUserAccessToken(code);
                console.error('✅ Access token received');
                
                this.token = accessToken;
                
                // Trigger cache initialization if available
                if (this.portalCacheHook) {
                  try {
                    const fakeRequest = new Request(this.authConfig.environmentUrl!, {
                      headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
                  } catch (error) {
                    // Cache init failure is non-fatal
                  }
                }
                
                console.error('🎉 Authentication complete! Stopping config server...');
                this.stopConfigServer();
                
              } catch (authError: any) {
                console.error('❌ Authentication monitoring error:', authError);
                this.stopConfigServer();
              }
            });
            
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        
        // Clear saved configuration
        if (url.pathname === '/clear-config' && req.method === 'POST') {
          try {
            const configPath = getConfigPath();
            if (fs.existsSync(configPath)) {
              fs.unlinkSync(configPath);
              console.error(`🗑️  Deleted config file: ${configPath}`);
            }
            
            // Clear in-memory config
            this.authConfig = {};
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Configuration cleared' }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        
        // Handle authentication request
        if (url.pathname === '/authenticate' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const config = JSON.parse(body);
              console.error('📝 Received configuration from browser form');
              
              // Validate URLs don't contain spaces (common mistake: pasting multiple URLs)
              const urlFields = [
                { name: 'eGain Environment URL', value: config.egainUrl },
                { name: 'Authorization URL', value: config.authUrl },
                { name: 'Access Token URL', value: config.accessTokenUrl },
                { name: 'Redirect URL', value: config.redirectUrl }
              ];
              
              for (const field of urlFields) {
                if (field.value && field.value.includes(' ')) {
                  const errorMsg = `❌ ${field.name} contains spaces! It looks like multiple URLs were pasted together. Please enter only ONE URL for this field.`;
                  console.error(errorMsg);
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    success: false, 
                    error: `${field.name} is invalid - contains multiple URLs. Please enter only one URL per field.`
                  }));
                  return;
                }
              }
              
              // Update authConfig from browser form data
              this.authConfig = {
                environmentUrl: config.egainUrl,
                authUrl: config.authUrl,
                accessUrl: config.accessTokenUrl,
                clientId: config.clientId,
                redirectUri: config.redirectUrl,
                clientSecret: config.clientSecret || undefined,
                scopePrefix: config.scopePrefix || undefined
              };
              
              // Save config to secure file storage (home directory)
              try {
                this.saveConfigToFile(this.authConfig);
                console.error('✅ Configuration saved to secure file storage');
              } catch (error) {
                console.error('⚠️  Failed to save config to file:', error);
                // Continue with authentication even if file save fails
              }
              
              // Generate OAuth URL and return it to frontend for redirect (single window flow)
              const oauthUrl = this.buildAuthUrl();
              console.error('🔐 Generated OAuth URL for browser redirect');
              console.error('🔗 OAuth URL:', oauthUrl);
              
              // Mark that OAuth redirect is about to happen (shorter timeout applies)
              this.oauthRedirectStarted = true;
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: true, 
                message: 'Configuration saved. Redirecting to login...',
                oauthUrl: oauthUrl  // Frontend will redirect to this URL
              }));
              
              // Start monitoring browser in background (for ANY redirect URL)
              console.error('🔍 Starting browser URL monitoring for authorization code...');
              setImmediate(async () => {
                try {
                  const code = await this.monitorBrowserForAuthCode();
                  console.error('✅ Authorization code detected:', code.substring(0, 10) + '...');
                  
                  const accessToken = await this.getUserAccessToken(code);
                  console.error('✅ Access token received');
                  
                  this.token = accessToken;
                  
                  // Trigger cache initialization if available
                  if (this.portalCacheHook) {
                    console.error('🔄 Triggering cache initialization...');
                    try {
                      const fakeRequest = new Request(this.authConfig.environmentUrl!, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                      });
                      await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
                      console.error('✅ Cache initialization completed');
                    } catch (error) {
                      console.error('⚠️  Cache initialization failed:', error);
                    }
                  }
                  
                  console.error('🎉 Authentication complete! Stopping config server...');
                  this.stopConfigServer();
                  
                } catch (authError: any) {
                  console.error('❌ Authentication monitoring error:', authError);
                  this.stopConfigServer();
                }
              });
              
            } catch (error: any) {
              console.error('❌ Error processing authentication request:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                error: error.message 
              }));
            }
          });
          return;
        }
        
        // Handle OAuth callback (after user completes Azure B2C login)
        if (url.pathname === '/callback' && req.method === 'GET') {
          try {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            
            if (error) {
              const errorDesc = url.searchParams.get('error_description') || 'No description';
              console.error('❌ OAuth error:', error, errorDesc);
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head><title>Authentication Error</title></head>
                  <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1>❌ Authentication Error</h1>
                    <p><strong>${error}</strong></p>
                    <p>${errorDesc}</p>
                    <p>You can close this window and try again.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                  </body>
                </html>
              `);
              return;
            }
            
            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Missing authorization code');
              return;
            }
            
            console.error('✅ Authorization code received from OAuth callback');
            
            // Exchange code for token (async in background)
            setImmediate(async () => {
              try {
                const accessToken = await this.getUserAccessToken(code);
                console.error('✅ Access token received');
                
                this.token = accessToken;
                
                // Trigger cache initialization if available
                if (this.portalCacheHook) {
                  try {
                    const fakeRequest = new Request(this.authConfig.environmentUrl!, {
                      headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
                  } catch (error) {
                    // Cache init failure is non-fatal
                  }
                }
                
                console.error('🎉 Authentication complete! Stopping config server...');
                // Stop server after successful authentication
                this.stopConfigServer();
                
              } catch (authError: any) {
                console.error('❌ Token exchange error:', authError);
                this.stopConfigServer();
              }
            });
            
            // Send success page to browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Authentication Complete</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                  <h1>✅ Authentication Complete!</h1>
                  <p>You can now close this window.</p>
                  <p style="color: #666; font-size: 14px;">This window will close automatically in 2 seconds...</p>
                  <script>setTimeout(() => window.close(), 2000);</script>
                </body>
              </html>
            `);
            
          } catch (error: any) {
            console.error('❌ Error handling OAuth callback:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Error</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                  <h1>❌ Error</h1>
                  <p>${error.message}</p>
                  <script>setTimeout(() => window.close(), 3000);</script>
                </body>
              </html>
            `);
          }
          return;
        }
        
        // Handle clear token request
        if (url.pathname === '/clear-token' && req.method === 'POST') {
          try {
            this.clearToken();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Token cleared' }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        
        // Handle authentication cancellation
        if (url.pathname === '/cancel' && req.method === 'POST') {
          console.error('🚫 User cancelled authentication');
          this.authCancelled = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Authentication cancelled' }));
          return;
        }
        
        // 404
        res.writeHead(404);
        res.end('Not Found');
      });

      this.configServer.listen(CONFIG_SERVER_PORT, CONFIG_SERVER_HOST, () => {
        console.error(`✅ Configuration server started at http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}`);
        resolve();
      });

      this.configServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${CONFIG_SERVER_PORT} is already in use`);
          reject(new Error(`Port ${CONFIG_SERVER_PORT} is already in use. Please close other applications using this port.`));
        } else {
          console.error('❌ Server error:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Stop the configuration HTTP server
   */
  private stopConfigServer(): void {
    if (this.configServer) {
      console.error('🚪 Stopping configuration server...');
      this.configServer.close(() => {
        console.error('✅ Configuration server stopped');
      });
      // Immediately set to null to prevent double-close
      this.configServer = null;
    }
  }

  /**
   * Open browser to configuration page
   */
  private async openConfigBrowser(): Promise<void> {
    const platform = process.platform;
    
    // Detect browser on macOS or Windows before opening
    if (platform === 'darwin' || platform === 'win32') {
      await this.detectDefaultBrowser();
    }
    
    console.error(`🌐 Browser: ${this.detectedBrowser}`);
    
    // Safari shows warning page instead of config form (security limitation)
    const configUrl = this.detectedBrowser === 'Safari' 
      ? `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/safari-warning`
      : `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/config`;
    
    if (this.detectedBrowser === 'Safari') {
      console.error('⚠️  Safari detected - showing browser installation guide...');
    } else {
      console.error('📋 Opening browser for configuration...');
    }
    
    const windowWidth = 600;
    const windowHeight = 800;
    
    try {
      if (platform === 'darwin') {
        // macOS - Open default browser in private mode
        const incognitoFlag = this.getIncognitoFlag();
        console.error(`🕵️  Using private mode flag: ${incognitoFlag || '(none - browser limitation)'}`);
        
        // Safari doesn't support --args flags well, use AppleScript for private browsing
        if (this.detectedBrowser === 'Safari') {
          console.error(`   Opening Safari in Private Browsing mode via AppleScript...`);
          
          // AppleScript to open Safari in private browsing mode
          const appleScript = `
            tell application "Safari"
              activate
              
              -- Try to open a new private window
              -- Note: This may not work in newer macOS versions due to security restrictions
              try
                make new document
                delay 0.5
                set URL of document 1 to "${configUrl}"
                
                -- Attempt to enable private browsing (may not work in all macOS versions)
                tell window 1
                  try
                    set private browsing to true
                  end try
                end tell
              on error
                -- Fallback: just open the URL in a new window
                open location "${configUrl}"
              end try
            end tell
          `.replace(/\n\s+/g, ' ');
          
          try {
            await execAsync(`osascript -e '${appleScript}'`);
            console.error(`⚠️  IMPORTANT: If Safari didn't open in Private Browsing mode:`);
            console.error(`   1. Close the Safari window`);
            console.error(`   2. Open Safari manually in Private Browsing (File > New Private Window)`);
            console.error(`   3. Navigate to: ${configUrl}`);
          } catch (error) {
            // Fallback to simple open if AppleScript fails
            console.error(`   AppleScript failed, using fallback method...`);
            await execAsync(`open -a "Safari" "${configUrl}"`);
            console.error(`⚠️  IMPORTANT: Please manually enable Private Browsing in Safari!`);
            console.error(`   (File > New Private Window, then go to: ${configUrl})`);
          }
        } else if (this.detectedBrowser === 'Firefox') {
          // Firefox: Use AppleScript to ensure private window opens even if Firefox is already running
          console.error(`   Opening Firefox in private browsing mode...`);
          
          const firefoxScript = `
            tell application "Firefox"
              activate
              
              -- Check if Firefox is running
              set isRunning to true
              
              -- Open new private window using Firefox's built-in command
              try
                -- Use Firefox's internal private browsing command
                do shell script "open -a Firefox --args --private-window '${configUrl}'"
              on error
                -- Fallback: try to open with just the private flag
                do shell script "open -na Firefox --args -private-window '${configUrl}'"
              end try
            end tell
          `.replace(/\n\s+/g, ' ');
          
          try {
            await execAsync(`osascript -e '${firefoxScript}'`);
          } catch (error) {
            // Ultimate fallback: force new instance with -n flag
            console.error(`   AppleScript failed, trying fallback...`);
            await execAsync(`open -na "Firefox" --args -private-window "${configUrl}"`);
          }
        } else {
          // Chrome, Edge, Brave, etc. support --args flags
          const args = incognitoFlag 
            ? `--args ${incognitoFlag} --app="${configUrl}" --window-size=${windowWidth},${windowHeight} --window-position=100,100`
            : `"${configUrl}"`; // Fallback for browsers without good CLI support
          
          const command = `open -n -a "${this.detectedBrowser}" ${args}`;
          console.error(`   Executing: open -n -a "${this.detectedBrowser}" ...`);
          
          await execAsync(command);
        }
      } else if (platform === 'win32') {
        // Windows - Open detected browser with private mode
        const incognitoFlag = this.getIncognitoFlag();
        console.error(`🕵️  Using private mode flag: ${incognitoFlag}`);
        
        if (this.detectedBrowser === 'firefox') {
          // Firefox on Windows needs special handling
          console.error(`   Executing: start firefox ${incognitoFlag} ...`);
          await execAsync(`cmd /c start "" "${this.detectedBrowser}" ${incognitoFlag} "${configUrl}"`);
        } else {
          // Chrome, Edge, Brave support --app mode
          console.error(`   Executing: start ${this.detectedBrowser} ${incognitoFlag} --app ...`);
          await execAsync(`cmd /c start "" "${this.detectedBrowser}" ${incognitoFlag} --app="${configUrl}" --window-size=${windowWidth},${windowHeight} --window-position=100,100`);
        }
      } else {
        // Linux - Use default browser
        console.error(`   Executing: xdg-open ...`);
        await execAsync(`xdg-open "${configUrl}"`);
      }
      console.error('✅ Browser opened successfully');
    } catch (error) {
      console.error('❌ Failed to open browser:', error instanceof Error ? error.message : error);
      console.error('⚠️  Please open manually: ' + configUrl);
    }
  }

  public async authenticate(): Promise<string> {
    try {
      // Try to use existing token first (lazy mode)
      console.error('🔐 Starting Azure B2C OAuth2 authentication...');
      
      // Fast validation using metadata (no API calls)
      if (this.isTokenValid()) {
        const existingToken = this.loadExistingToken();
        if (existingToken) {
          console.error('🎉 Using existing valid bearer token (lazy mode)');
          this.token = existingToken;
          
          // Trigger cache initialization with existing token
          if (this.portalCacheHook) {
            try {
              const fakeRequest = new Request(this.authConfig.environmentUrl || 'https://api-dev9.knowledge.ai/knowledge', {
                headers: { 'Authorization': `Bearer ${existingToken}` }
              });
              await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
            } catch (error) {
              // Cache init failure is non-fatal
            }
          }
          
          return this.token;
        }
      } else {
        console.error('⏰ Existing token is expired or not found, proceeding with fresh login...');
      }
      
      // Check if we have configuration (from .env or file)
      const hasConfig = this.authConfig.environmentUrl && this.authConfig.clientId && 
                        this.authConfig.redirectUri && this.authConfig.authUrl && this.authConfig.accessUrl;
      
      if (!hasConfig) {
        console.error('📝 No configuration found, starting browser-based configuration...');
      } else {
        console.error('✅ Configuration found, opening browser for authentication...');
      }
      
      console.error('🌐 A browser window will open for you to authenticate');
      
      // Start config server and open browser (for both cases)
      await this.startConfigServer();
      await this.openConfigBrowser();
      
      // Two-phase timeout:
      // Phase 1: Filling config form (generous time)
      // Phase 2: After OAuth redirect, logging in (shorter time)
      const configFormTimeout = 900000; // 15 minutes for filling form
      const oauthLoginTimeout = 300000; // 5 minutes after OAuth redirect
      const checkInterval = 1000; // 1 second
      const startTime = Date.now();
      
      while (!this.token && !this.authCancelled) {
        const elapsed = Date.now() - startTime;
        
        // Determine which timeout applies
        const currentTimeout = this.oauthRedirectStarted ? oauthLoginTimeout : configFormTimeout;
        const timeoutLabel = this.oauthRedirectStarted ? 'OAuth login' : 'configuration form';
        
        if (elapsed >= currentTimeout) {
          this.stopConfigServer();
          throw new Error(`Authentication timeout (${timeoutLabel}). Please try again.`);
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      if (this.authCancelled) {
        this.stopConfigServer();
        this.authCancelled = false; // Reset for next attempt
        this.oauthRedirectStarted = false; // Reset flag
        throw new Error('Authentication cancelled by user. Authentication is required to use eGain MCP tools.');
      }
      
      // Final check: ensure token was actually received
      if (!this.token) {
        this.stopConfigServer();
        throw new Error('Authentication completed but no token received. Please try again.');
      }
      
      console.error('✅ Authentication completed');
      return this.token;
    } catch (error) {
      this.stopConfigServer();
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async beforeRequest(_hookCtx: HookContext, request: Request): Promise<Request> {
    // Check if request already has valid Authorization header
    const existingAuth = request.headers.get('Authorization');
    if (existingAuth && existingAuth.startsWith('Bearer ') && this.isTokenValid()) {
      return request;
    }

    // Get or refresh token
    if (!this.token || !this.isTokenValid()) {
      this.token = await this.authenticate();
    }

    // Clone the request and add the Authorization header
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    
    const requestOptions: RequestInit = {
      method: request.method,
      headers: headers,
      signal: request.signal,
    };
    
    if (request.body) {
      requestOptions.body = request.body;
      (requestOptions as any).duplex = 'half';
    }
    
    return new Request(request.url, requestOptions);
  }

  sdkInit(opts: SDKOptions): SDKOptions {
    // Check if bearer token was provided via CLI flag
    if (opts.security && typeof opts.security === 'object' && 'bearerAuth' in opts.security) {
      const providedToken = (opts.security as any).bearerAuth;
      if (providedToken && typeof providedToken === 'string' && providedToken.trim().length > 0) {
        console.error('🔑 Using bearer token from CLI flag');
        this.token = providedToken;
        return opts;
      }
    }

    // Load existing token if available  
    if (!this.token) {
      this.token = this.loadExistingToken();
    }

    // If we have a token, set up the security provider
    if (this.token) {
      return {
        ...opts,
        security: { accessToken: this.token }
      };
    }

    // No token available - set up async authentication
    const securityProvider = async () => {
      const token = await this.authenticate();
      return { accessToken: token };
    };

    return {
      ...opts,
      security: securityProvider,
    };
  }

  private findProjectRoot(): string[] {
    const roots: string[] = [];
    
    // Always prioritize process.cwd() as the primary project root
    const cwd = process.cwd();
    const cwdPackageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(cwdPackageJsonPath)) {
      roots.push(cwd);
      // Only return the current working directory to ensure we stay within the project
      return roots;
    }
    
    // If no package.json in cwd, search up from __dirname but limit to reasonable project boundaries
    let currentDir = __dirname;
    const maxLevelsUp = 5; // Reasonable limit to prevent going too far up
    
    for (let i = 0; i < maxLevelsUp; i++) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        // Only add if it's not already in roots and seems to be within a reasonable project structure
        if (!roots.includes(currentDir)) {
          roots.push(currentDir);
        }
        break;
      }
      
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached filesystem root
      currentDir = parentDir;
    }
    
    return roots;
  }
}
