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
  private devToolsPort: number | null = null; // DevTools Protocol debug port (Windows, non-loopback)
  private devToolsTempDir: string | null = null; // Temp directory for DevTools browser instance
  private configPageHtml: string | null = null; // Cached config page HTML
  private configPageJs: string | null = null; // Cached config page JavaScript


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
   * Preload config page content for faster serving
   */
  private preloadConfigPage(): void {
    if (this.configPageHtml && this.configPageJs) {
      return; // Already loaded
    }
    
    try {
      const projectRoot = getProjectRoot();
      const htmlPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.html');
      const jsPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.js');
      
      this.configPageHtml = fs.readFileSync(htmlPath, 'utf8');
      this.configPageJs = fs.readFileSync(jsPath, 'utf8');
      console.error('✅ Config page content preloaded');
    } catch (error) {
      console.error('⚠️  Could not preload config page:', error);
      // Set fallbacks
      this.configPageHtml = '<html><body><h1>Configuration Error</h1><p>Could not load configuration page.</p></body></html>';
      this.configPageJs = '';
    }
  }

  /**
   * Load HTML page for browser-based configuration
   */
  private getConfigPage(): string {
    if (this.configPageHtml) {
      return this.configPageHtml;
    }
    
    // Fallback if not preloaded
    try {
      const projectRoot = getProjectRoot();
      const htmlPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.html');
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load config page:', error);
      return '<html><body><h1>Configuration Error</h1><p>Could not load configuration page.</p></body></html>';
    }
  }

  /**
   * Serve JavaScript for config page
   */
  private getConfigPageJS(): string {
    if (this.configPageJs !== null) {
      return this.configPageJs;
    }
    
    // Fallback if not preloaded
    try {
      const projectRoot = getProjectRoot();
      const jsPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'config-page.js');
      return fs.readFileSync(jsPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load config page JS:', error);
      return '';
    }
  }

  /**
   * Get browser error page for monitoring issues
   */
  private getBrowserErrorPage(): string {
    try {
      const projectRoot = getProjectRoot();
      const htmlPath = path.join(projectRoot, 'src', 'hooks', 'auth-pages', 'browser-error.html');
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error('⚠️  Could not load browser error page:', error);
      // Fallback minimal HTML
      return '<html><body><h1>Browser Monitoring Issue</h1><p>We cannot read the current page URL from your browser. Please restart your browser and try again.</p></body></html>';
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
    
    // Always use PKCE flow (no client_secret)
    existingParams.set('code_challenge', this.codeChallenge);
    existingParams.set('code_challenge_method', 'S256');
    console.error('🔐 Using PKCE flow (public client)');
    
    // Reconstruct the full URL
    const fullUrl = `${baseUrl}?${existingParams.toString()}`;
    return fullUrl;
  }

  /**
   * Monitor browser window for authorization code in URL
   * Works with ANY redirect URL - detects when URL contains code= parameter
   */
  private async getUserAccessToken(code: string): Promise<string> {
    const { clientId, redirectUri, accessUrl } = this.authConfig;
    
    console.error('🔄 Starting token exchange with PKCE...');
    
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
      // Always use PKCE flow (public client)
      console.error('🔄 Using PKCE flow (code_verifier)...');
      
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

      console.error('📨 Token response received:', publicResponse.status, publicResponse.statusText);

      if (publicResponse.ok) {
        const data = await publicResponse.json() as { access_token?: string; expires_in?: number };
        
        if (data.access_token) {
          console.error('✅ Token received');
          await this.saveTokenWithExpiration(data.access_token, data.expires_in);
          return data.access_token;
        } else {
          throw new Error('No access_token in response');
        }
      } else {
        const errorText = await publicResponse.text();
        console.error('❌ Token exchange failed:', publicResponse.status);
        throw new Error(`Token request failed: ${publicResponse.status} - ${errorText}`);
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
          // Delete expired token files to prevent reuse
          const projectRoot = getProjectRoot();
          const tokenPath = path.join(projectRoot, '.bearer_token');
          
          try {
            if (fs.existsSync(tokenPath)) {
              fs.unlinkSync(tokenPath);
              console.error('🗑️  Deleted expired bearer token file');
            }
            if (fs.existsSync(metadataPath)) {
              fs.unlinkSync(metadataPath);
              console.error('🗑️  Deleted expired bearer token metadata file');
            }
          } catch (error) {
            console.error('⚠️  Failed to delete expired token files:', error);
          }
          
          // Clear in-memory token to prevent reuse
          this.token = null;
          
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
      } else {
        // Token file doesn't exist, clear in-memory token if it was set
        if (this.token) {
          console.error('🗑️  Token file deleted, clearing in-memory token');
          this.token = null;
        }
      }
    } catch (error) {
      console.error('Could not load existing token:', error);
      // Clear in-memory token on error as well
      if (this.token) {
        this.token = null;
      }
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
    // Preload config page content before starting server for faster response
    this.preloadConfigPage();
    
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
        
        // Serve browser error page (handles Safari, Firefox, Chrome issues, and other monitoring errors)
        if (url.pathname === '/browser-error') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getBrowserErrorPage());
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
            // Check if Firefox is detected - if so, redirect to error page instead of OAuth
            if (this.detectedBrowser === 'Firefox' && process.platform === 'darwin') {
              console.error(`❌ Firefox detected - browser URL monitoring not available`);
              console.error(`⚠️  Redirecting to error page instead of OAuth URL`);
              const errorUrl = `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/browser-error?type=monitoring&browser=${encodeURIComponent(this.detectedBrowser)}`;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: true, 
                oauthUrl: errorUrl  // Frontend will redirect to error page instead
              }));
              return;
            }
            
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
              await this.monitorBrowserWithRetry();
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
              
              // Check if Firefox is detected - if so, redirect to error page instead of OAuth
              if (this.detectedBrowser === 'Firefox' && process.platform === 'darwin') {
                console.error(`❌ Firefox detected - browser URL monitoring not available`);
                console.error(`⚠️  Redirecting to error page instead of OAuth URL`);
                const errorUrl = `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/browser-error?type=monitoring&browser=${encodeURIComponent(this.detectedBrowser)}`;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: true, 
                  message: 'Firefox detected - showing browser compatibility information...',
                  oauthUrl: errorUrl  // Frontend will redirect to error page instead
                }));
                return;
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
                await this.monitorBrowserWithRetry();
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
                
                // Close browser window on Windows (macOS handles this via AppleScript in monitoring)
                if (process.platform === 'win32') {
                  try {
                    await this.closeConfigBrowserWindow();
                  } catch (error) {
                    // Ignore close errors
                  }
                }
                
                // Stop server after successful authentication
                this.stopConfigServer();
                
              } catch (authError: any) {
                const errorMessage = authError.message || String(authError);
                const isScopeError = errorMessage.includes('invalid_scope') || 
                                   errorMessage.toLowerCase().includes('scope');
                const isRetryableError = errorMessage.includes('access_denied') || 
                                       errorMessage.includes('invalid_grant') ||
                                       errorMessage.toLowerCase().includes('password') || 
                                       errorMessage.toLowerCase().includes('username') ||
                                       errorMessage.toLowerCase().includes('credential');
                
                if (isScopeError) {
                  // Scope errors are configuration issues - stop server
                  console.error('❌ OAuth scope error:', errorMessage);
                  console.error('💡 This is a configuration error. Please check your scope settings.');
                  console.error('🛑 Stopping server - please fix the configuration and try again.');
                  this.stopConfigServer();
                } else if (isRetryableError) {
                  // Username/password errors can be retried - keep server running
                  console.error('❌ OAuth authentication error:', errorMessage);
                  console.error('💡 The configuration server will remain running. Please try again with correct credentials.');
                } else {
                  // Other token exchange errors - stop server
                  console.error('❌ Token exchange error:', authError);
                  this.stopConfigServer();
                }
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
        
        // Verify the server is actually responding before resolving
        // Use a separate async function to properly await
        (async () => {
          console.error('⏳ Verifying config server is ready...');
          let verified = false;
          const maxAttempts = 15; // Increased attempts
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const resp = await fetch(`http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/config`, {
                signal: AbortSignal.timeout(500) // Shorter timeout for faster checks
              });
              if (resp.ok) {
                verified = true;
                console.error(`✅ Config server verified and ready (attempt ${i + 1}/${maxAttempts})`);
                break;
              }
            } catch (error: any) {
              // Server not ready yet, wait a bit
              if (i < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, 100)); // Shorter wait between attempts
              }
            }
          }
          
          if (!verified) {
            console.error('⚠️  Config server verification timed out - server may still be starting');
            console.error('   Continuing anyway - browser will retry if needed');
          }
          
          resolve();
        })();
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
   * Helper method to close popup window (Windows)
   */
  private async closePopupWindow(browserUsed: string): Promise<void> {
    try {
      const browserProcessName = browserUsed.replace('-app-incognito', '').replace('-app', '');
      console.error(`🔄 Attempting to close browser window (${browserProcessName})...`);
      
      // More aggressive approach: close all instances of the browser process
      // This is safe because we launched it in a temp profile directory
      // Use semicolons to separate PowerShell commands instead of newlines
      const psScript = `$processes = Get-Process -Name "${browserProcessName}" -ErrorAction SilentlyContinue; if ($processes) { Write-Output "Found $($processes.Count) ${browserProcessName} process(es)"; $processes | Stop-Process -Force; Write-Output "Closed ${browserProcessName} processes" } else { Write-Output "No ${browserProcessName} processes found" }`;
      
      const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
      console.error(`   ${stdout.trim()}`);
      console.error('✅ Browser window close command executed');
    } catch (error: any) {
      console.error(`⚠️  Error closing browser window: ${error.message || error}`);
      // Try fallback: close config browser window
      try {
        await this.closeConfigBrowserWindow();
      } catch (fallbackError) {
        console.error('⚠️  Fallback close also failed');
      }
    }
  }

  /**
   * Close the config browser window (Windows)
   */
  private async closeConfigBrowserWindow(): Promise<void> {
    try {
      // Determine browser executable name
      let browserExe = 'chrome';
      if (this.detectedBrowser === 'msedge') {
        browserExe = 'msedge';
      } else if (this.detectedBrowser === 'firefox') {
        browserExe = 'firefox';
      } else if (this.detectedBrowser === 'brave') {
        browserExe = 'brave';
      }
      
      // Close browser windows that might be showing the config page
      // Look for windows with titles containing our config server URL
      const psScript = `
        Get-Process -Name "${browserExe}" -ErrorAction SilentlyContinue | 
          Where-Object { $_.MainWindowTitle -like '*localhost:3333*' -or $_.MainWindowTitle -like '*127.0.0.1:3333*' } | 
          Stop-Process -Force
      `.replace(/\n\s+/g, ' ');
      await execAsync(`powershell -Command "${psScript}"`);
    } catch (error) {
      // Ignore close errors - window might already be closed
    }
  }

  /**
   * Windows-specific monitoring using loopback server or DevTools Protocol
   */
  private async monitorBrowserWindows(): Promise<string> {
    const timeout = 120; // 2 minutes
    const startTime = Date.now();
    const redirectUri = this.authConfig.redirectUri!;
    
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      throw new Error('Invalid EGAIN_REDIRECT_URI. Expected a valid URL.');
    }

    const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) && !!parsed.port;
    const isConfigServerCallback = parsed.hostname === CONFIG_SERVER_HOST && 
                                   parseInt(parsed.port, 10) === CONFIG_SERVER_PORT &&
                                   parsed.pathname === '/callback';

    // If redirect URI points to our config server callback, use the existing callback handler
    // The browser is already navigating there, so we just wait for the token to be set
    if (isConfigServerCallback) {
      console.error(`🔍 Waiting for callback via config server at ${redirectUri}...`);
      const deadline = Date.now() + timeout * 1000;
      while (Date.now() < deadline) {
        if (this.token) {
          // Token was set by the callback handler - close the browser window
          await this.closeConfigBrowserWindow();
          console.error('✅ Found authorization code via config server callback');
          console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
          return 'code-received'; // Placeholder - token already set
        }
        await new Promise(r => setTimeout(r, 500));
      }
      throw new Error('Authentication timeout. Please try again.');
    }

    if (isLoopback) {
      // Loopback redirect - start HTTP server on the redirect port
      const host = parsed.hostname;
      const port = parseInt(parsed.port, 10);
      const pathname = parsed.pathname || '/';
      console.error(`🔊 Starting local callback server at ${host}:${port}${pathname} to capture auth code...`);

      const authCodePromise = new Promise<string>((resolve, reject) => {
        let settled = false;
        const server = http.createServer((req, res) => {
          try {
            if (!req.url) return;
            const reqUrl = new URL(req.url, `http://${host}:${port}`);
            if (reqUrl.pathname !== pathname) {
              res.statusCode = 404;
              res.end('Not Found');
              return;
            }

            const code = reqUrl.searchParams.get('code');
            const err = reqUrl.searchParams.get('error');

            if (code) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end('<html><body><h3>Authentication complete. You can close this window.</h3><script>window.close && window.close();</script></body></html>');
              if (!settled) {
                settled = true;
                server.close(() => {});
                resolve(code);
              }
            } else if (err) {
              const desc = reqUrl.searchParams.get('error_description') || 'No description';
              res.statusCode = 400;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(`<html><body><h3>Authentication error: ${err}</h3><p>${desc}</p></body></html>`);
              if (!settled) {
                settled = true;
                server.close(() => {});
                reject(new Error(`OAuth error: ${err} - ${desc}`));
              }
            } else {
              res.statusCode = 400;
              res.end('Missing code');
            }
          } catch (e) {
            try { res.statusCode = 500; res.end('Internal Server Error'); } catch {
              // Ignore errors if response was already sent or connection closed
            }
          }
        });

        server.listen(port, host, () => {
          console.error('✅ Local callback server is listening');
        });

        const to = setTimeout(() => {
          if (!settled) {
            settled = true;
            server.close(() => {});
            reject(new Error('Authentication timeout. Please try again.'));
          }
        }, timeout * 1000);

        server.on('close', () => {
          clearTimeout(to);
        });
      });

      // Browser is already open - it will redirect to the OAuth URL and then back to our callback
      // We just wait for the callback, then close the browser window
      const code = await authCodePromise;
      // Close the browser window immediately after getting the code
      await this.closeConfigBrowserWindow();
      console.error('✅ Found authorization code via loopback redirect');
      console.error(`🔑 Extracted authorization code: ${code.substring(0, 10)}...`);
      console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
      return code;
    }

    // Non-loopback (e.g., oauth.pstmn.io): Use Chrome DevTools protocol to watch URL changes
    // DevTools Protocol should already be enabled from openConfigBrowser()
    // The config page JavaScript will handle navigation to OAuth URL, we just monitor via DevTools
    if (!this.devToolsPort || !this.devToolsTempDir) {
      throw new Error('DevTools Protocol not initialized. This should not happen for non-loopback redirects.');
    }
    
    console.error('🔄 Using existing DevTools connection to monitor OAuth redirect...');
    console.error(`🛠️  DevTools Protocol port: ${this.devToolsPort}`);
    console.error('💡 The config page will navigate to OAuth URL automatically');
    console.error('⏳ Note: Initial page load may take a moment due to DevTools Protocol overhead');
    console.error('   Please wait for the config page to fully load before proceeding...');

    const redirectBase = `${parsed.origin}${parsed.pathname}`;
    const deadline = Date.now() + timeout * 1000;

    const pollTargets = async (): Promise<string> => {
      const endpoints = [
        `http://127.0.0.1:${this.devToolsPort}/json/list`,
        `http://127.0.0.1:${this.devToolsPort}/json`
      ];
      let pollCount = 0;
      const logInterval = 10; // Log every 10 polls (every 5 seconds)
      
      console.error(`🔍 Starting to poll DevTools for redirect to: ${redirectBase}`);
      console.error(`   Deadline: ${new Date(deadline).toLocaleTimeString()} (${Math.round((deadline - Date.now()) / 1000)}s remaining)`);
      
      while (Date.now() < deadline) {
        pollCount++;
        const timeRemaining = Math.round((deadline - Date.now()) / 1000);
        
        if (pollCount % logInterval === 0) {
          console.error(`   Poll ${pollCount}: Checking for redirect... (${timeRemaining}s remaining)`);
        }
        
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, {
              signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            if (!resp.ok) {
              if (pollCount % logInterval === 0) {
                console.error(`   Poll ${pollCount}: DevTools responded with status ${resp.status}`);
              }
              continue;
            }
            
            const targets = await resp.json() as Array<{ url?: string; type?: string }>;
            
            if (pollCount % logInterval === 0 && targets.length > 0) {
              const urls = targets.map(t => t.url || '(no URL)').slice(0, 2);
              console.error(`   Poll ${pollCount}: Checking ${targets.length} target(s), URLs: ${urls.join(', ')}${targets.length > 2 ? '...' : ''}`);
            }
            
            for (const t of targets) {
              const tUrl = t.url || '';
              if (tUrl.includes(redirectBase)) {
                console.error(`   ✅ Found redirect URL matching base: ${tUrl.substring(0, 100)}...`);
                
                const codeMatch = tUrl.match(/[?&]code=([^&]+)/);
                if (codeMatch && codeMatch[1]) {
                  console.error(`   ✅ Authorization code found in URL!`);
                  return codeMatch[1];
                }
                
                const errMatch = tUrl.match(/[?&]error=([^&]+)/);
                if (errMatch && errMatch[1]) {
                  const errDescMatch = tUrl.match(/error_description=([^&]+)/);
                  const errDesc = errDescMatch && errDescMatch[1] ? decodeURIComponent(errDescMatch[1]) : 'No description';
                  throw new Error(`OAuth error: ${decodeURIComponent(errMatch[1])} - ${errDesc}`);
                }
              }
            }
          } catch (error: any) {
            if (pollCount % logInterval === 0 && error.name !== 'AbortError') {
              console.error(`   Poll ${pollCount}: Error checking DevTools: ${error.message || error}`);
            }
            // Continue polling
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
      throw new Error('Authentication timeout. Please try again.');
    };

    try {
      const code = await pollTargets();
      
      console.error('✅ Found authorization code via DevTools polling');
      console.error(`🔑 Extracted authorization code: ${code.substring(0, 20)}...`);
      
      // Close the browser window immediately after getting the code
      console.error('🔄 Closing browser window...');
      let browserExe = 'chrome';
      if (this.detectedBrowser === 'msedge') {
        browserExe = 'msedge';
      } else if (this.detectedBrowser === 'brave') {
        browserExe = 'brave';
      }
      
      const browserUsed = `${browserExe}-app-incognito`;
      console.error(`   Browser process: ${browserExe}`);
      console.error(`   Browser identifier: ${browserUsed}`);
      
      await this.closePopupWindow(browserUsed);
      
      console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
      return code;
    } catch (e) {
      // Close browser on error too
      let browserExe = 'chrome';
      if (this.detectedBrowser === 'msedge') {
        browserExe = 'msedge';
      } else if (this.detectedBrowser === 'brave') {
        browserExe = 'brave';
      }
      await this.closePopupWindow(`${browserExe}-app-incognito`);
      throw e;
    } finally {
      try {
        // Best-effort cleanup of temp profile directory
        if (this.devToolsTempDir) {
          fs.rmSync(this.devToolsTempDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors - temp directory will be cleaned up by OS eventually
      }
      // Reset DevTools state
      this.devToolsPort = null;
      this.devToolsTempDir = null;
    }
  }

  /**
   * Monitor browser for authorization code with retry on OAuth errors
   * This method will continue monitoring even after OAuth errors (like wrong password)
   * to allow users to retry authentication
   */
  private async monitorBrowserWithRetry(): Promise<void> {
    const platform = process.platform;
    const timeout = 120; // 2 minutes
    const startTime = Date.now();
    let oAuthErrorLogged = false;
    let lastUrl = '';
    let lastErrorUrl: string | null = null;
    let aboutBlankCount = 0;
    const ABOUT_BLANK_THRESHOLD = 1; // Show error after 5 consecutive about:blank readings
    let firefoxWarningLogged = false;
    
    // Windows uses a different monitoring approach
    if (platform === 'win32') {
      try {
        const code = await this.monitorBrowserWindows();
        
        // If code is 'code-received', token was already set by callback handler
        if (code === 'code-received') {
          // Token already set, just ensure cache is initialized
          if (this.portalCacheHook && this.token) {
            try {
              const fakeRequest = new Request(this.authConfig.environmentUrl!, {
                headers: { 'Authorization': `Bearer ${this.token}` }
              });
              await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
              console.error('✅ Cache initialization completed');
            } catch (error) {
              console.error('⚠️  Cache initialization failed:', error);
            }
          }
          console.error('🎉 Authentication complete! Stopping config server...');
          this.stopConfigServer();
          return; // Success - exit
        }
        
        // Otherwise, exchange code for token
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
            console.error('✅ Cache initialization completed');
          } catch (error) {
            console.error('⚠️  Cache initialization failed:', error);
          }
        }
        
        console.error('🎉 Authentication complete! Stopping config server...');
        this.stopConfigServer();
        return; // Success - exit
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        const isScopeError = errorMessage.includes('invalid_scope') || 
                           errorMessage.toLowerCase().includes('scope');
        const isRetryableError = errorMessage.includes('access_denied') || 
                               errorMessage.includes('invalid_grant') ||
                               errorMessage.toLowerCase().includes('password') || 
                               errorMessage.toLowerCase().includes('username') ||
                               errorMessage.toLowerCase().includes('credential');
        
        if (isScopeError) {
          console.error('❌ OAuth scope error:', errorMessage);
          console.error('💡 This is a configuration error. Please check your scope settings.');
          console.error('🛑 Stopping server - please fix the configuration and try again.');
          this.stopConfigServer();
        } else if (isRetryableError) {
          console.error('❌ OAuth authentication error:', errorMessage);
          console.error('💡 Please try again with correct credentials.');
          // For retryable errors, we could potentially restart monitoring, but for now we'll stop
          this.stopConfigServer();
        } else {
          console.error('❌ Authentication monitoring error:', error);
          this.stopConfigServer();
        }
        return; // Exit on error
      }
    }
    
    // Log monitoring start only once
    if (platform === 'darwin') {
      if (this.detectedBrowser === 'Firefox') {
        // Firefox is not supported - cannot monitor URLs to detect authorization code
        // Error page should have already been shown, but if monitoring is called, exit early
        console.error(`❌ Firefox detected - Firefox is not supported for authentication`);
        console.error(`⚠️  Firefox cannot detect authorization codes from external redirect URLs`);
        console.error(`💡 Please use Chrome, Edge, or Brave browser instead`);
        return;
      } else {
        console.error(`🔍 Monitoring ${this.detectedBrowser} for authorization code...`);
      }
    }
    
    while (true) {
      try {
        // Check timeout
        if ((Date.now() - startTime) >= timeout * 1000) {
          throw new Error('Authentication timeout. Please try again.');
        }
        
        let currentUrl = '';
        let browserMonitoringError = false;
        
        if (platform === 'darwin') {
          // macOS - Get URL from browser using AppleScript or JXA
          try {
            const browserName = this.detectedBrowser.replace(/"/g, '\\"'); // Escape quotes in browser name
            
            if (this.detectedBrowser === 'Firefox') {
              // Firefox: Skip browser monitoring - Firefox doesn't support URL reading via AppleScript
              // Rely on OAuth callback URL handler instead (which works for all browsers)
              browserMonitoringError = true;
              currentUrl = '';
            } else {
              // Chrome and other browsers: Use standard AppleScript
              const script = `tell application "${browserName}" to get URL of active tab of front window`;
              const { stdout, stderr } = await execAsync(`osascript -e '${script}'`);
              currentUrl = stdout.trim();
              
              // Check for AppleScript syntax errors
              if (stderr && (stderr.includes('syntax error') || stderr.includes('Expected end of line'))) {
                console.error(`❌ AppleScript syntax error detected for ${this.detectedBrowser}`);
                browserMonitoringError = true;
              }
            }
          } catch (scriptError: any) {
            // Check if this is a syntax error
            const errorMessage = scriptError.message || scriptError.stderr || '';
            if (errorMessage.includes('syntax error') || errorMessage.includes('Expected end of line') || errorMessage.includes("A property can't go after")) {
              console.error(`❌ Browser automation error for ${this.detectedBrowser}:`, errorMessage);
              browserMonitoringError = true;
            } else {
              // Other errors (like browser not running) - continue monitoring
              currentUrl = '';
            }
          }
        }
        
        // Detect about:blank issue (Chrome sometimes reports this incorrectly)
        if (currentUrl === 'about:blank' || currentUrl === 'about:blank#') {
          aboutBlankCount++;
          
          if (aboutBlankCount === 1) {
            // First detection: Try refreshing the page to fix Chrome's URL reporting
            // This often resolves the issue without redirecting away from OAuth callback
            console.error(`⚠️  Detected "about:blank" - attempting to refresh page to fix Chrome URL reporting...`);
            try {
              if (platform === 'darwin') {
                // Try to refresh the current tab
                await execAsync(`osascript -e 'tell application "${this.detectedBrowser}" to tell active tab of front window to reload'`);
              }
            } catch (refreshError) {
              // Refresh might fail if page doesn't support it - that's okay
              console.error('⚠️  Could not refresh page:', refreshError);
            }
            // Wait a bit longer after refresh attempt
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (aboutBlankCount >= ABOUT_BLANK_THRESHOLD) {
            // Multiple detections: Redirect to error page
            console.error(`❌ Detected ${aboutBlankCount} consecutive "about:blank" readings - Chrome may need to be restarted`);
            // Redirect browser to error page (skip for Firefox as it doesn't support URL setting)
            if (this.detectedBrowser !== 'Firefox') {
              try {
                const errorUrl = `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/browser-error?type=aboutblank&browser=${encodeURIComponent(this.detectedBrowser)}`;
                if (platform === 'darwin') {
                  await execAsync(`osascript -e 'tell application "${this.detectedBrowser}" to set URL of active tab of front window to "${errorUrl}"'`);
                }
              } catch (redirectError) {
                console.error('⚠️  Could not redirect browser to error page:', redirectError);
              }
            } else {
              console.error('⚠️  Firefox detected - cannot redirect. Please manually navigate to the error page if needed.');
            }
            // Continue monitoring - user might restart Chrome and try again
          }
        } else {
          // Reset counter if we get a valid URL
          aboutBlankCount = 0;
        }
        
        // Handle browser monitoring errors (like Firefox AppleScript syntax errors)
        if (browserMonitoringError) {
          if (this.detectedBrowser === 'Firefox') {
            // Firefox doesn't support URL monitoring via AppleScript/JXA
            // Rely on OAuth callback URL handler instead - skip browser monitoring
            // Log warning only once to avoid spam
            if (!firefoxWarningLogged) {
              firefoxWarningLogged = true;
            }
            // Don't continue monitoring for Firefox - rely on callback handler
            // But don't exit the loop - wait for callback or timeout
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            // For other browsers, redirect to error page in the same window
            console.error(`❌ Browser monitoring error detected for ${this.detectedBrowser}`);
            try {
              const errorUrl = `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/browser-error?type=monitoring&browser=${encodeURIComponent(this.detectedBrowser)}`;
              if (platform === 'darwin') {
                // Navigate the current tab to error page (stays in same incognito window)
                await execAsync(`osascript -e 'tell application "${this.detectedBrowser}" to set URL of active tab of front window to "${errorUrl}"'`);
              }
            } catch (redirectError) {
              console.error('⚠️  Could not redirect browser to error page:', redirectError);
            }
            // Continue monitoring - user might fix permissions and try again
            // But wait longer between checks to avoid spam
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        // Only log URL when it changes
        if (currentUrl && currentUrl !== lastUrl && currentUrl !== 'about:blank' && currentUrl !== 'about:blank#') {
          lastUrl = currentUrl;
          console.error(`🔍 Current URL: ${currentUrl}`);
        }
        
        // Check if URL contains code= parameter
        if (currentUrl && currentUrl.includes('code=')) {
          const codeMatch = currentUrl.match(/[?&]code=([^&]+)/);
          if (codeMatch && codeMatch[1]) {
            const code = decodeURIComponent(codeMatch[1]);
            console.error('✅ Found authorization code in URL!');
            console.error(`🔑 Extracted authorization code (first 20 chars): ${code.substring(0, 20)}...`);
            
            // Close browser window (non-blocking)
            setImmediate(async () => {
              try {
                if (process.platform === 'darwin') {
                  await execAsync(`osascript -e 'tell application "${this.detectedBrowser}" to close front window'`);
                }
                // Note: Windows case handled separately in monitorBrowserWindows()
              } catch (closeError) {
                // Ignore close errors
              }
            });
            
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
                console.error('✅ Cache initialization completed');
              } catch (error) {
                console.error('⚠️  Cache initialization failed:', error);
              }
            }
            
            console.error('🎉 Authentication complete! Stopping config server...');
            this.stopConfigServer();
            return; // Success - exit the loop
          }
        }
        
        // Check for error parameters - only throw if this is a new error URL
        if (currentUrl && currentUrl.includes('error=')) {
          if (currentUrl !== lastErrorUrl) {
            lastErrorUrl = currentUrl;
            const errorMatch = currentUrl.match(/[?&]error=([^&]+)/);
            const errorDescMatch = currentUrl.match(/error_description=([^&]+)/);
            const error = errorMatch && errorMatch[1] ? decodeURIComponent(errorMatch[1]) : 'unknown_error';
            const errorDesc = errorDescMatch && errorDescMatch[1] ? decodeURIComponent(errorDescMatch[1]) : 'No description';
            
            // Scope errors are configuration issues - stop monitoring and let user see error
            // Username/password errors can be retried - continue monitoring
            const isScopeError = error === 'invalid_scope' || errorDesc.toLowerCase().includes('scope');
            const isRetryableError = error === 'access_denied' || error === 'invalid_grant' || 
                                    errorDesc.toLowerCase().includes('password') || 
                                    errorDesc.toLowerCase().includes('username') ||
                                    errorDesc.toLowerCase().includes('credential');
            
            // Log error only once
            if (!oAuthErrorLogged) {
              console.error('❌ OAuth authentication error:', `${error} - ${errorDesc}`);
              
              if (isScopeError) {
                console.error('💡 This is a configuration error. Please check your scope settings and close this window.');
                console.error('🛑 Stopping monitoring - please fix the configuration and try again.');
                oAuthErrorLogged = true;
                // Stop monitoring for scope errors - user needs to fix config
                this.stopConfigServer();
                return; // Exit the monitoring loop
              } else if (isRetryableError) {
                console.error('💡 The configuration server will remain running. Please try again with correct credentials.');
                console.error('🔍 Continuing to monitor browser for authorization code...');
                oAuthErrorLogged = true;
              } else {
                // Unknown error type - be conservative and stop
                console.error('💡 Please check the error message displayed in your browser and close the window.');
                console.error('🛑 Stopping monitoring.');
                oAuthErrorLogged = true;
                this.stopConfigServer();
                return; // Exit the monitoring loop
              }
            }
            // Continue monitoring silently for retryable errors - don't throw, just keep checking
          }
          // If it's the same error URL, continue monitoring silently
        } else {
          // Reset error tracking if URL no longer contains error
          if (lastErrorUrl !== null) {
            lastErrorUrl = null;
            oAuthErrorLogged = false; // Reset so we can log new errors
          }
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        // Only handle non-OAuth errors here (OAuth errors are handled above)
        if (!(error instanceof Error && error.message.includes('OAuth error:'))) {
          console.error('❌ Authentication monitoring error:', error);
          this.stopConfigServer();
          return; // Exit the loop
        }
        // OAuth errors are handled in the main loop above
      }
    }
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
    
    // Safari shows error page instead of config form (not supported)
    const configUrl = this.detectedBrowser === 'Safari' 
      ? `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/browser-error?type=notsupported&browser=${encodeURIComponent(this.detectedBrowser)}`
      : `http://${CONFIG_SERVER_HOST}:${CONFIG_SERVER_PORT}/config`;
    
    if (this.detectedBrowser === 'Safari') {
      console.error('⚠️  Safari detected - Safari is not supported for authentication');
    } else {
      console.error('📋 Opening browser for configuration...');
    }
    
    // Check if we need DevTools Protocol (Windows + non-loopback redirect)
    let needsDevTools = false;
    if (platform === 'win32' && this.authConfig.redirectUri) {
      try {
        const parsed = new URL(this.authConfig.redirectUri);
        const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) && !!parsed.port;
        const isConfigServerCallback = parsed.hostname === CONFIG_SERVER_HOST && 
                                       parseInt(parsed.port, 10) === CONFIG_SERVER_PORT &&
                                       parsed.pathname === '/callback';
        needsDevTools = !isLoopback && !isConfigServerCallback;
        
        if (needsDevTools) {
          // Set up DevTools Protocol from the start
          this.devToolsPort = Math.floor(40000 + Math.random() * 10000);
          this.devToolsTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egain-chrome-'));
          console.error(`🛠️  Enabling DevTools Protocol (port ${this.devToolsPort}) for URL monitoring`);
        }
      } catch (e) {
        // Invalid redirect URI, will be handled later
      }
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
          // Firefox: Open in private browsing mode
          // Use -a (not -n) to reuse existing instance if running, which prevents multiple windows
          console.error(`   Opening Firefox in private browsing mode...`);
          
          try {
            // Use -a to reuse existing instance, --args to pass flags, --private-window for private mode
            // This will open a private window in existing Firefox instance, or start Firefox in private mode
            await execAsync(`open -a "Firefox" --args --private-window "${configUrl}"`);
          } catch (error) {
            // Fallback: try with -n flag (forces new instance) if reuse fails
            console.error(`   First attempt failed, trying with new instance...`);
            try {
              await execAsync(`open -na "Firefox" --args --private-window "${configUrl}"`);
            } catch (fallbackError) {
              // Last resort: open normally and warn user
              console.error(`   ⚠️  Could not open Firefox in private mode automatically`);
              console.error(`   ⚠️  Please manually open Firefox in Private Browsing mode`);
              await execAsync(`open -a "Firefox" "${configUrl}"`);
            }
          }
        } else if (this.detectedBrowser === 'Opera') {
          // Opera: Use --private flag but pass URL directly (not --app mode)
          console.error(`   Opening Opera in private mode...`);
          try {
            const args = incognitoFlag 
              ? `--args ${incognitoFlag} "${configUrl}"`
              : `"${configUrl}"`;
            await execAsync(`open -n -a "Opera" ${args}`);
          } catch (error) {
            // Fallback: try without -n flag
            console.error(`   First attempt failed, trying with existing instance...`);
            try {
              const args = incognitoFlag 
                ? `--args ${incognitoFlag} "${configUrl}"`
                : `"${configUrl}"`;
              await execAsync(`open -a "Opera" ${args}`);
            } catch (fallbackError) {
              // Last resort: open normally
              console.error(`   ⚠️  Could not open Opera in private mode automatically`);
              await execAsync(`open -a "Opera" "${configUrl}"`);
            }
          }
        } else {
          // Chrome, Edge, Brave, Vivaldi, etc. support --args flags with --app mode
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
        
        if (needsDevTools && this.devToolsPort && this.devToolsTempDir) {
          // For non-loopback redirects, launch with DevTools Protocol enabled
          let browserExe = 'chrome';
          if (this.detectedBrowser === 'msedge') {
            browserExe = 'msedge';
          } else if (this.detectedBrowser === 'brave') {
            browserExe = 'brave';
          }
          
          // Use --app mode for cleaner window (user preference)
          const command = `cmd /c start "" "${browserExe}" ${incognitoFlag} --remote-debugging-port=${this.devToolsPort} --user-data-dir="${this.devToolsTempDir}" --app="${configUrl}" --window-size=${windowWidth},${windowHeight} --window-position=100,100`;
          console.error(`   Executing: start ${browserExe} with DevTools Protocol...`);
          await execAsync(command);
          
          // Wait for browser to start - give it a moment before checking DevTools
          console.error('⏳ Waiting for browser process to start...');
          await new Promise(r => setTimeout(r, 2000)); // Give browser 2 seconds to start
          
          // Now check if DevTools Protocol is accessible (simplified check)
          console.error(`⏳ Checking DevTools Protocol on port ${this.devToolsPort}...`);
          let devToolsReady = false;
          const maxWaitTime = 8000; // 8 seconds max
          const startWait = Date.now();
          let checkCount = 0;
          
          while (!devToolsReady && (Date.now() - startWait) < maxWaitTime) {
            checkCount++;
            try {
              const resp = await fetch(`http://127.0.0.1:${this.devToolsPort}/json/list`, {
                signal: AbortSignal.timeout(1500) // 1.5 second timeout per request
              });
              if (resp.ok) {
                const targets = await resp.json() as Array<{ url?: string; type?: string }>;
                
                // Check if config page has loaded
                const configPageLoaded = targets.some(t => t.url && t.url.includes(CONFIG_SERVER_HOST));
                if (configPageLoaded) {
                  console.error(`   ✅ Config page loaded in browser (check ${checkCount})`);
                  devToolsReady = true;
                  break;
                } else if (targets.length > 0) {
                  // DevTools is accessible but page not loaded yet
                  if (checkCount === 1 || checkCount % 5 === 0) {
                    console.error(`   Check ${checkCount}: DevTools accessible, waiting for page to load...`);
                  }
                }
              }
            } catch (error: any) {
              if (checkCount === 1 || checkCount % 5 === 0) {
                console.error(`   Check ${checkCount}: DevTools not accessible yet...`);
              }
            }
            await new Promise(r => setTimeout(r, 500));
          }
          
          if (!devToolsReady) {
            console.error('⚠️  Page may still be loading, but DevTools Protocol is set up');
            console.error('   The browser window should show the config page shortly');
          } else {
            console.error(`✅ Browser and config page ready (${((Date.now() - startWait) / 1000).toFixed(1)}s)`);
          }
          console.error('✅ Browser opened successfully');
        } else if (this.detectedBrowser === 'firefox') {
          // Firefox on Windows needs special handling
          console.error(`   Executing: start firefox ${incognitoFlag} ...`);
          await execAsync(`cmd /c start "" "${this.detectedBrowser}" ${incognitoFlag} "${configUrl}"`);
          // Wait for browser to actually open
          console.error('⏳ Waiting for browser to open and page to load...');
          await new Promise(r => setTimeout(r, 3000));
          console.error('✅ Browser opened successfully');
        } else {
          // Chrome, Edge, Brave support --app mode
          console.error(`   Executing: start ${this.detectedBrowser} ${incognitoFlag} --app ...`);
          await execAsync(`cmd /c start "" "${this.detectedBrowser}" ${incognitoFlag} --app="${configUrl}" --window-size=${windowWidth},${windowHeight} --window-position=100,100`);
          // Wait for browser to actually open and page to start loading
          console.error('⏳ Waiting for browser to open and page to load...');
          await new Promise(r => setTimeout(r, 3000));
          console.error('✅ Browser opened successfully');
        }
      } else {
        // Linux - Use default browser
        console.error(`   Executing: xdg-open ...`);
        await execAsync(`xdg-open "${configUrl}"`);
        // Wait for browser to actually open
        await new Promise(r => setTimeout(r, 2000));
        console.error('✅ Browser opened successfully');
      }
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
        // Clear in-memory token to ensure fresh authentication
        this.token = null;
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
    // Check if bearer token was provided via CLI flag or config
    if (opts.security && typeof opts.security === 'object') {
      const securityObj = opts.security as any;
      // Check for accessToken (used by eGain SDK)
      if ('accessToken' in securityObj) {
        const providedToken = securityObj.accessToken;
        if (providedToken && typeof providedToken === 'string' && providedToken.trim().length > 0) {
          console.error('🔑 Using bearer token from CLI flag/config');
          this.token = providedToken.trim();
          return opts;
        }
      }
      // Also check for bearerAuth (generic SDK format)
      if ('bearerAuth' in securityObj) {
        const providedToken = securityObj.bearerAuth;
        if (providedToken && typeof providedToken === 'string' && providedToken.trim().length > 0) {
          console.error('🔑 Using bearer token from CLI flag/config');
          this.token = providedToken.trim();
          return opts;
        }
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
