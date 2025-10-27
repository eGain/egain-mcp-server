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
import { promisify } from "util";

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

export class AuthenticationHook implements SDKInitHook, BeforeRequestHook {
  private token: string | null = null;
  private authConfig: AuthConfig;
  private codeVerifier: string;
  private codeChallenge: string;
  private portalCacheHook?: any; // PortalCacheHook reference


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


  private loadAuthConfig(): AuthConfig {
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
        } else {
          console.error(`❌ No .env file at: ${possiblePath}`);
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
                case 'AUTH_URL':
                  config.authUrl = cleanValue;
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

  private validateConfig(): void {
    const { environmentUrl, clientId, redirectUri, authUrl, accessUrl } = this.authConfig;
    
    if (!environmentUrl || !clientId || !redirectUri || !authUrl || !accessUrl) {
      throw new Error(
        'Missing required environment variables. Please set:\n' +
        '- EGAIN_ENVIRONMENT_URL\n' +
        '- EGAIN_CLIENT_ID\n' +
        '- EGAIN_REDIRECT_URI\n' +
        '- AUTH_URL\n' +
        '- ACCESS_URL\n' +
        '\nOptional variables:\n' +
        '- EGAIN_SCOPE_PREFIX (defaults to empty string if not provided)\n' +
        '- EGAIN_CLIENT_SECRET (required only for confidential clients)'
      );
    }
  }

  private buildAuthUrl(): string {
    const { environmentUrl, clientId, redirectUri, authUrl, scopePrefix } = this.authConfig;
    
    console.error('🔧 Building OAuth URL with:');
    console.error('   Environment URL (domain_hint):', environmentUrl);
    console.error('   Auth URL:', authUrl);
    console.error('   Client ID:', clientId?.substring(0, 8) + '...');
    console.error('   Scope Prefix:', scopePrefix || '(none - using default scopes)');
    
    // Use scopePrefix if provided, otherwise use default scopes without prefix
    const prefix = scopePrefix || '';
    const scope = `${prefix}knowledge.portalmgr.manage ${prefix}knowledge.portalmgr.read ${prefix}core.aiservices.read`;
    
    // Token expiration is now handled automatically by isTokenValid() method
    
    // Build URL manually like Python version to avoid URLSearchParams encoding issues
    let fullUrl = (
      `${authUrl}` +
      `?domain_hint=${environmentUrl}` +
      `&client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&code_challenge=${this.codeChallenge}` +
      `&code_challenge_method=S256`
    );
    
    // Force login mechanism removed - tokens are now managed automatically
    // Always use prompt=login to ensure fresh authentication when needed
    fullUrl += `&prompt=login`;
    console.error('🔄 Added prompt=login to ensure fresh authentication');
    
    console.error('🌐 Full OAuth URL constructed');
    return fullUrl;
  }

  private async openChromePopup(url: string): Promise<string> {
    console.error('🌐 Opening Chrome authentication popup...');
    console.error('📋 Authentication URL:', url);
    console.error('Complete authentication in the popup - it will close automatically when done.');

    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // macOS - Prefer app mode for popup style, but with better URL handling
        try {
          // Method 1: Chrome app mode with incognito (exact match to Python)
          console.error(`🚀 Method 1: Opening Chrome incognito app mode popup (matching Python)...`);
          await execAsync(`open -n -a "Google Chrome" --args --incognito --app="${url}"`);
          console.error('✅ Chrome incognito app mode popup opened successfully');
          await new Promise(resolve => setTimeout(resolve, 3000)); // Give more time for app mode
          return 'Chrome-app-incognito';
        } catch (error) {
          console.error(`❌ Method 1 failed: ${error}`);
          try {
            // Method 2: Fallback to regular incognito new window (exact match to Python)
            console.error(`🚀 Method 2: Fallback to regular incognito new window...`);
            await execAsync(`open -n -a "Google Chrome" --args --incognito --new-window "${url}"`);
            console.error('✅ Chrome incognito new window opened successfully');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return 'Chrome-incognito';
          } catch (error2) {
            console.error(`❌ Method 2 failed: ${error2}`);
            // Method 3: Two-step approach
            console.error(`🚀 Method 3: Two-step approach...`);
            await execAsync(`open -n -a "Google Chrome" --args --incognito`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            await execAsync(`open "${url}"`);
            console.error('✅ Chrome two-step opened');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return 'Chrome-two-step';
          }
        }
      } else if (platform === 'win32') {
        // Windows - Use cmd with app mode (popup-like) and incognito
        await execAsync(`cmd /c start "" chrome --incognito --app="${url}"`);
        console.error('✅ Chrome incognito app-mode popup opened successfully');
        return 'Chrome-app-incognito';
      } else {
        throw new Error('Linux is not supported. Use macOS or Windows for automatic authentication.');
      }
    } catch (error) {
      throw new Error(`Chrome failed to open: ${error}`);
    }
  }

  private async getPopupUrl(browserUsed: string): Promise<string> {
    try {
      const platform = process.platform;
      
      if (platform === 'darwin' && browserUsed.startsWith('Chrome')) {
        // Get URL from Chrome using AppleScript
        const script = `
          tell application "Google Chrome"
            try
              set currentURL to URL of active tab of front window
              return currentURL
            on error
              return ""
            end try
          end tell
        `;
        
        const { stdout } = await execAsync(`osascript -e '${script}'`);
        return stdout.trim();
      }
    } catch {
      // Ignore errors
    }
    
    return '';
  }

  private async closePopupWindow(browserUsed: string): Promise<void> {
    if (browserUsed === 'failed') return;
    
    console.error('🔒 Closing popup window...');
    
    try {
      const platform = process.platform;
      
      if (platform === 'darwin' && browserUsed.startsWith('Chrome')) {
        // Close specific Chrome auth window using AppleScript
        const script = `
          tell application "Google Chrome"
            try
              repeat with theWindow in windows
                repeat with theTab in tabs of theWindow
                  if URL of theTab contains "oauth.pstmn.io" or URL of theTab contains "b2clogin.com" then
                    close theWindow
                    return
                  end if
                end repeat
              end repeat
              -- Fallback: close the most recent incognito window
              repeat with theWindow in reverse of windows
                if incognito of theWindow is true then
                  close theWindow
                  return
                end if
              end repeat
            end try
          end tell
        `;
        
        await execAsync(`osascript -e '${script}'`);
      } else if (platform === 'win32') {
        // Windows - send Ctrl+W
        await execAsync('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^w\')"');
      }
    } catch (error) {
      console.error(`Could not auto-close popup: ${error}`);
    }
  }

  private async getUserAuthorizationCodeWithPopup(): Promise<string> {
    this.validateConfig();
    
    const oauthUrl = this.buildAuthUrl();
    
    const platform = process.platform;
    const timeout = 120; // 2 minutes (reduced from 5)
    const startTime = Date.now();
    
    if (platform === 'darwin') {
      const browserUsed = await this.openChromePopup(oauthUrl);
      // macOS - automatic URL monitoring
      let lastUrl = '';
      let firstCheck = true;
      
      while ((Date.now() - startTime) < timeout * 1000) {
        const currentUrl = await this.getPopupUrl(browserUsed);
        
        if (currentUrl && currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          
          if (firstCheck) {
            console.error(`🔍 Initial URL: ${currentUrl}`);
            firstCheck = false;
          } else {
            console.error(`🔍 URL Changed: ${currentUrl}`);
          }
        } else if (firstCheck) {
          // No URL detected yet, show debug info
          firstCheck = false;
        }
        
        // Always check for callback URL (whether URL changed or not)
        if (currentUrl && currentUrl.includes(this.authConfig.redirectUri!) && currentUrl.includes('code=')) {
          console.error('✅ Found authorization code in callback URL - closing popup immediately');
          // Close popup immediately when we detect the callback
          await this.closePopupWindow(browserUsed);
          
          // Extract the code from the URL
          const codeMatch = currentUrl.match(/code=([^&]+)/);
          if (codeMatch && codeMatch[1]) {
            console.error(`🔑 Extracted authorization code: ${codeMatch[1].substring(0, 10)}...`);
            console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
            return codeMatch[1];
          } else {
            console.error('❌ Failed to extract authorization code from URL');
          }
        }
        
        // Also check for error parameters
        if (currentUrl && currentUrl.includes('error=')) {
          const errorMatch = currentUrl.match(/error=([^&]+)/);
          const errorDescMatch = currentUrl.match(/error_description=([^&]+)/);
          const error = errorMatch && errorMatch[1] ? decodeURIComponent(errorMatch[1]) : 'unknown_error';
          const errorDesc = errorDescMatch && errorDescMatch[1] ? decodeURIComponent(errorDescMatch[1]) : 'No description';
          
          await this.closePopupWindow(browserUsed);
          throw new Error(`OAuth error: ${error} - ${errorDesc}`);
        }
        
        // Wait 500ms before checking again (faster polling)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Timeout reached
      console.error('⏰ Timeout reached waiting for authentication completion.');
      await this.closePopupWindow(browserUsed);
      throw new Error('Authentication timeout. Please try again.');
      
    } else if (platform === 'win32') {
      // Windows - support both loopback redirect and non-loopback (e.g., oauth.pstmn.io) via DevTools
      const redirectUri = this.authConfig.redirectUri!;
      let parsed: URL;
      try {
        parsed = new URL(redirectUri);
      } catch {
        throw new Error('Invalid EGAIN_REDIRECT_URI. Expected a valid URL.');
      }

      const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) && !!parsed.port;

      if (isLoopback) {
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
              try { res.statusCode = 500; res.end('Internal Server Error'); } catch {}
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

        const browserUsed = await this.openChromePopup(oauthUrl);
        try {
          const code = await authCodePromise;
          console.error('✅ Found authorization code via loopback redirect - closing popup immediately');
          await this.closePopupWindow(browserUsed);
          console.error(`🔑 Extracted authorization code: ${code.substring(0, 10)}...`);
          console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
          return code;
        } catch (e) {
          await this.closePopupWindow(browserUsed);
          throw e;
        }
      }

      // Non-loopback (e.g., oauth.pstmn.io): Use Chrome DevTools protocol to watch URL changes
      const debugPort = Math.floor(40000 + Math.random() * 10000);
      const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egain-chrome-'));
      console.error(`🛠️  Launching Chrome with remote debugging port ${debugPort}`);

      // Launch Chrome directly here to include remote debugging flags
      await execAsync(`cmd /c start "" chrome --incognito --remote-debugging-port=${debugPort} --user-data-dir="${tempUserDataDir}" --app="${oauthUrl}"`);

      const browserUsed = 'Chrome-app-incognito';

      const redirectBase = `${parsed.origin}${parsed.pathname}`;
      const deadline = Date.now() + timeout * 1000;

      const pollTargets = async (): Promise<string> => {
        const endpoints = [
          `http://127.0.0.1:${debugPort}/json/list`,
          `http://127.0.0.1:${debugPort}/json`
        ];
        while (Date.now() < deadline) {
          for (const ep of endpoints) {
            try {
              const resp = await fetch(ep);
              if (!resp.ok) throw new Error(String(resp.status));
              const targets = await resp.json() as Array<{ url?: string }>;
              for (const t of targets) {
                const tUrl = t.url || '';
                if (tUrl.includes(redirectBase)) {
                  const codeMatch = tUrl.match(/[?&]code=([^&]+)/);
                  if (codeMatch && codeMatch[1]) {
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
            } catch {
              // Ignore and keep polling
            }
          }
          await new Promise(r => setTimeout(r, 500));
        }
        throw new Error('Authentication timeout. Please try again.');
      };

      try {
        const code = await pollTargets();
        console.error('✅ Found authorization code via DevTools polling - closing popup immediately');
        await this.closePopupWindow(browserUsed);
        console.error(`🔑 Extracted authorization code: ${code.substring(0, 10)}...`);
        console.error('⚡ Authentication completed in', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
        return code;
      } catch (e) {
        await this.closePopupWindow(browserUsed);
        throw e;
      } finally {
        try {
          // Best-effort cleanup of temp profile directory
          fs.rmSync(tempUserDataDir, { recursive: true, force: true });
        } catch {}
      }
    } else {
      throw new Error('Linux is not supported. Use macOS or Windows for automatic authentication.');
    }
  }

  private async getUserAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUri, accessUrl } = this.authConfig;
    
    console.error('🔄 Starting token exchange...');
    console.error('   Code length:', code.length);
    console.error('   Access URL:', accessUrl);
    console.error('   Client ID:', clientId?.substring(0, 8) + '...');
    
    // Temporarily disable SSL verification for development/testing
    // This is a workaround for corporate networks or certificate issues
    const originalRejectUnauthorized = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      // First attempt: Try without client_secret (for public clients)
      console.error('🔄 Attempt 1: Trying token exchange without client_secret (public client mode)...');
      
      const publicClientBody = new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri!,
        client_id: clientId!,
        code_verifier: this.codeVerifier
      });

      console.error('🌐 Making token request (public client)...');
      console.error('   URL:', accessUrl);
      console.error('   Body preview:', publicClientBody.toString().substring(0, 100) + '...');
      
      const publicResponse = await fetch(accessUrl!, {
        method: 'POST',
        headers,
        body: publicClientBody
      });

      console.error('📨 Token response received (public client):', publicResponse.status, publicResponse.statusText);

      if (publicResponse.ok) {
        const data = await publicResponse.json() as { access_token?: string; expires_in?: number };
        console.error('✅ Token response parsed successfully (public client)');
        console.error('📋 Token response data:', { 
          has_access_token: !!data.access_token, 
          expires_in: data.expires_in 
        });
        
        if (data.access_token) {
          console.error('🎉 Access token received successfully using public client mode!');
          
          // Store token with expiration metadata
          await this.saveTokenWithExpiration(data.access_token, data.expires_in);
          
          return data.access_token;
        } else {
          console.error('❌ No access_token in public client response:', data);
        }
      } else {
        const errorText = await publicResponse.text();
        console.error('❌ Public client token request failed:', publicResponse.status, errorText);
        
        // Check if this is the specific "public client should not send client_secret" error
        // If so, we know we're dealing with a public client and shouldn't try with secret
        if (errorText.includes('AADB2C90084') || errorText.includes('Public clients should not send a client_secret')) {
          throw new Error(`Token request failed (public client): ${publicResponse.status} - ${errorText}`);
        }
        
        // For other errors, we'll try the confidential client approach as fallback
        console.error('🔄 Public client failed with different error, trying confidential client as fallback...');
      }
      
      // Second attempt: Try with client_secret (for confidential clients)
      if (clientSecret) {
        console.error('🔄 Attempt 2: Trying token exchange with client_secret (confidential client mode)...');
        
        const confidentialClientUrl = (
          `${accessUrl}` +
          `?code=${code}` +
          `&grant_type=authorization_code` +
          `&redirect_uri=${redirectUri}` +
          `&client_id=${clientId}` +
          `&client_secret=${clientSecret}` +
          `&code_verifier=${this.codeVerifier}`
        );

        console.error('🌐 Making token request (confidential client)...');
        console.error('   URL preview:', confidentialClientUrl.substring(0, 100) + '...');
        
        const confidentialResponse = await fetch(confidentialClientUrl, {
          method: 'POST',
          headers
        });

        console.error('📨 Token response received (confidential client):', confidentialResponse.status, confidentialResponse.statusText);

        if (confidentialResponse.ok) {
          const data = await confidentialResponse.json() as { access_token?: string; expires_in?: number };
          console.error('✅ Token response parsed successfully (confidential client)');
          console.error('📋 Token response data:', { 
            has_access_token: !!data.access_token, 
            expires_in: data.expires_in 
          });
          
          if (data.access_token) {
            console.error('🎉 Access token received successfully using confidential client mode!');
            
            // Store token with expiration metadata
            await this.saveTokenWithExpiration(data.access_token, data.expires_in);
            
            return data.access_token;
          } else {
            console.error('❌ No access_token in confidential client response:', data);
            throw new Error('No access_token in confidential client response');
          }
        } else {
          const errorText = await confidentialResponse.text();
          console.error('❌ Confidential client token request failed:', confidentialResponse.status, errorText);
          throw new Error(`Token request failed (confidential client): ${confidentialResponse.status} - ${errorText}`);
        }
      } else {
        console.error('❌ No client_secret available for confidential client fallback');
        throw new Error('Both public and confidential client approaches failed, and no client_secret available for retry');
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
      // Calculate expiration timestamp
      const now = Date.now();
      const expirationTime = expiresIn ? now + (expiresIn * 1000) : now + (3600 * 1000); // Default 1 hour
      
      const tokenData = {
        token,
        expiresAt: expirationTime,
        createdAt: now
      };
      
      // Save to the project root directory (not current working directory)
      const projectRoot = getProjectRoot();
      const tokenPath = path.join(projectRoot, '.bearer_token');
      const metadataPath = path.join(projectRoot, '.bearer_token_metadata');
      
      try {
        // Save token file
        fs.writeFileSync(tokenPath, token);
        // Save metadata file
        fs.writeFileSync(metadataPath, JSON.stringify(tokenData, null, 2));
        
        console.error(`💾 Access token saved to ${tokenPath}`);
        console.error(`📅 Token expires at: ${new Date(expirationTime).toISOString()}`);
      } catch (error) {
        console.error(`❌ Failed to save token to ${tokenPath}:`, error);
        // Fallback to old method
        await this.saveToken(token);
      }
    } catch (error) {
      console.error('Could not save token with expiration:', error);
      // Fallback to old method
      await this.saveToken(token);
    }
  }

  /**
   * Checks if the stored token is expired without making API calls
   * @returns true if token is valid, false if expired or not found
   */
  private isTokenValid(): boolean {
    try {
      // Only check in the current working directory (project root)
      const projectRoot = getProjectRoot();
      const metadataPath = path.join(projectRoot, '.bearer_token_metadata');
      
      
      if (fs.existsSync(metadataPath)) {
        console.error(`✅ AUTH: Found metadata file: ${metadataPath}`);
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        const tokenData = JSON.parse(metadataContent);
        
        const now = Date.now();
        const timeUntilExpiry = tokenData.expiresAt - now;
        
        console.error(`🕐 AUTH: Current time: ${now}, Token expires at: ${tokenData.expiresAt}`);
        console.error(`⏱️  AUTH: Time until expiry: ${Math.round(timeUntilExpiry / 1000)} seconds`);
        
        if (timeUntilExpiry > 60000) { // Valid if more than 1 minute left
          console.error(`✅ AUTH: Token valid for ${Math.round(timeUntilExpiry / 1000 / 60)} more minutes`);
          return true;
        } else {
          console.error(`⏰ AUTH: Token expires in ${Math.round(timeUntilExpiry / 1000)} seconds - treating as expired`);
          return false;
        }
      } else {
        console.error(`❌ AUTH: Metadata file not found: ${metadataPath}`);
      }
      
      console.error('📭 AUTH: No token metadata found - cannot determine expiration');
      return false;
    } catch (error) {
      console.error('⚠️  AUTH: Error checking token validity:', error);
      return false; // Assume expired if we can't check
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

  public async authenticate(): Promise<string> {
    try {
      // Try to use existing token first (lazy mode)
      console.error('🔐 Starting Azure B2C OAuth2 authentication...');
      
      // Fast validation using metadata (no API calls)
      if (this.isTokenValid()) {
        const existingToken = this.loadExistingToken();
        if (existingToken) {
          console.error('🎉 Using existing valid bearer token (lazy mode)');
          console.error('💡 Run `npm run logout` to clear tokens and force fresh login');
          this.token = existingToken;
          
          // Trigger cache initialization with existing token
          if (this.portalCacheHook) {
            console.error('🔄 AUTH: Triggering cache initialization with existing token...');
            try {
              const fakeRequest = new Request('https://api-dev9.knowledge.ai/knowledge', {
                headers: { 'Authorization': `Bearer ${existingToken}` }
              });
              await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
              console.error('✅ AUTH: Cache initialization completed with existing token');
            } catch (error) {
              console.error('⚠️  AUTH: Cache initialization failed with existing token:', error);
              // Don't fail authentication if cache init fails
            }
          }
          
          return this.token;
        }
      } else {
        console.error('⏰ Existing token is expired or not found, proceeding with fresh login...');
      }
      
      // Use the popup-based authentication flow
      const authCode = await this.getUserAuthorizationCodeWithPopup();
      console.error('✅ Authorization code received');
      
      // Get the access token using the captured code
      const accessToken = await this.getUserAccessToken(authCode);
      console.error('✅ Access token received');
      
      // Save the token for future use
      await this.saveToken(accessToken);
      
      this.token = accessToken;
      
      // Trigger cache initialization immediately after authentication
      if (this.portalCacheHook) {
        console.error('🔄 AUTH: Triggering cache initialization after authentication...');
        try {
          // Create a fake request with the bearer token to initialize cache
          const fakeRequest = new Request('https://api-dev9.knowledge.ai/knowledge', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          await this.portalCacheHook.ensureCacheInitialized(fakeRequest);
          console.error('✅ AUTH: Cache initialization completed after authentication');
        } catch (error) {
          console.error('⚠️  AUTH: Cache initialization failed after authentication:', error);
          // Don't fail authentication if cache init fails
        }
      }
      
      return this.token;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async beforeRequest(_hookCtx: HookContext, request: Request): Promise<Request> {
    console.error('🔒 AUTH: beforeRequest triggered');
    
    // Check if request already has Authorization header
    const existingAuth = request.headers.get('Authorization');
    if (existingAuth && existingAuth.startsWith('Bearer ')) {
      
      // Even if request has a token, we need to validate it's not expired
      const isValid = this.isTokenValid();
      
      if (isValid) {
        console.error('✅ AUTH: Existing Bearer token is valid, using as-is');
        return request;
      } else {
        console.error('⏰ AUTH: Existing Bearer token is expired, need to refresh...');
        // Continue to token refresh logic below
      }
    } else {
      console.error('📭 AUTH: No Bearer token in request headers');
    }

    // Check if we need a token (new or expired)
    if (!this.token || !this.isTokenValid()) {
      if (!this.token) {
        console.error('🔐 AUTH: No token available, starting authentication...');
      } else {
        console.error('⏰ AUTH: Token expired, starting re-authentication...');
        this.token = null; // Clear expired token
      }
      this.token = await this.authenticate();
    } else {
      console.error('✅ AUTH: Using existing valid token from memory');
    }

    // Clone the request and add the Authorization header
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    
    // Create request options with proper duplex handling for Node.js
    const requestOptions: RequestInit = {
      method: request.method,
      headers: headers,
      signal: request.signal,
    };
    
    // Only add body and duplex if there's a body
    if (request.body) {
      requestOptions.body = request.body;
      // Set duplex for Node.js fetch compatibility when there's a body
      (requestOptions as any).duplex = 'half';
    }
    
    const authenticatedRequest = new Request(request.url, requestOptions);

    console.error('✅ AUTH: Request authenticated with Bearer token');
    return authenticatedRequest;
  }

  sdkInit(opts: SDKOptions): SDKOptions {
    console.error('🔧 AUTH: sdkInit called');
    
    // Check if bearer token was provided via CLI flag
    if (opts.security && typeof opts.security === 'object' && 'bearerAuth' in opts.security) {
      const providedToken = (opts.security as any).bearerAuth;
      if (providedToken && typeof providedToken === 'string' && providedToken.trim().length > 0) {
        console.error('🔑 AUTH: Using bearer token provided via --bearer-auth flag');
        this.token = providedToken;
        return opts;
      }
    }

    // Load existing token if available  
    if (!this.token) {
      this.token = this.loadExistingToken();
      if (this.token) {
        console.error('🔑 AUTH: Loaded existing bearer token during SDK init');
      }
    }

    // If we have a token, set up the security provider
    if (this.token) {
      console.error('🔒 AUTH: Setting up security provider with existing token');
      return {
        ...opts,
        security: { accessToken: this.token }
      };
    }

    // No token available - set up async authentication
    console.error('🔐 AUTH: No token available, setting up async authentication provider');
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
