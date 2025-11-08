#!/usr/bin/env node

/**
 * Login script for eGain MCP Server
 * Performs Azure B2C OAuth2 authentication and saves the token
 * 
 * Usage:
 *   node scripts/login.js                    # Normal mode (auto-detect browser)
 *   node scripts/login.js --force-chrome     # Force Chrome
 *   node scripts/login.js --force-firefox    # Force Firefox
 *   node scripts/login.js --force-edge       # Force Microsoft Edge
 *   node scripts/login.js --force-safari     # Force Safari
 *   node scripts/login.js --force-brave      # Force Brave Browser
 * 
 *   npm run login                            # Normal mode
 *   FORCE_BROWSER="Firefox" npm run login    # Force any browser via env var
 */

import { AuthenticationHook } from '../esm/src/hooks/auth-hook.js';

// Platform-specific browser name mapping
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Browser name mapping for command-line flags
const browserMap = {
  '--force-chrome': isWindows ? 'chrome' : 'Google Chrome',
  '--force-firefox': isWindows ? 'firefox' : 'Firefox',
  '--force-edge': isWindows ? 'msedge' : 'Microsoft Edge',
  '--force-safari': 'Safari', // macOS only
  '--force-brave': isWindows ? 'brave' : 'Brave Browser',
  '--force-vivaldi': isWindows ? 'vivaldi' : 'Vivaldi',
  '--force-opera': isWindows ? 'opera' : 'Opera',
  // Short flags
  '-c': isWindows ? 'chrome' : 'Google Chrome',
  '-f': isWindows ? 'firefox' : 'Firefox',
  '-e': isWindows ? 'msedge' : 'Microsoft Edge',
  '-s': 'Safari',
  '-b': isWindows ? 'brave' : 'Brave Browser'
};

// Check for command-line flags
const args = process.argv.slice(2);
for (const arg of args) {
  if (browserMap[arg]) {
    const browser = browserMap[arg];
    const displayName = isWindows 
      ? (browser === 'chrome' ? 'Google Chrome' :
         browser === 'msedge' ? 'Microsoft Edge' :
         browser === 'firefox' ? 'Firefox' :
         browser === 'brave' ? 'Brave Browser' : browser)
      : browser;
    console.log(`🧪 FORCING ${displayName.toUpperCase()} FOR TESTING\n`);
    process.env.FORCE_BROWSER = browser;
    break;
  }
}

console.log('🔐 eGain MCP Login');
console.log('==================\n');

async function login() {
  try {
    const authHook = new AuthenticationHook();
    console.log('🚀 Starting authentication...');
    console.log('📋 A browser window will open for configuration/authentication\n');
    
    const token = await authHook.authenticate();
    
    console.log('\n==================');
    console.log('✅ Login successful!');
    console.log('🔑 Token:', token.substring(0, 30) + '...');
    console.log('📏 Length:', token.length, 'characters');
    console.log('💡 You can now use the MCP server');
    console.log('🚪 Run `node scripts/logout.js` to clear authentication\n');
    
  } catch (error) {
    console.log('\n==================');
    console.log('❌ Login failed!');
    console.log('💥 Error:', error.message);
    
    if (process.env.DEBUG) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
    
    console.log('');
    process.exit(1);
  }
}

// Run the login
login();
