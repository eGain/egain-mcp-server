#!/usr/bin/env node

/**
 * Login script for eGain MCP Server
 * Performs Azure B2C OAuth2 authentication and saves the token
 * 
 * Usage: 
 *   node scripts/login.js
 *   OR make executable: chmod +x scripts/login.js && ./scripts/login.js
 */

import { AuthenticationHook } from '../esm/src/hooks/auth-hook.js';

console.log('🔐 eGain MCP Login');
console.log('==================');

try {
  // Create authentication hook instance
  const authHook = new AuthenticationHook();
  
  console.log('🚀 Starting authentication process...');
  console.log('📋 A popup window will open for you to complete authentication.');
  console.log('⏳ Please wait while we authenticate...');
  
  // Perform authentication
  const token = await authHook.authenticate();
  
  console.log('==================');
  console.log('🎉 Login successful!');
  console.log('✅ Authentication token saved');
  console.log('🔑 Token preview:', token.substring(0, 20) + '...');
  console.log('💡 You can now use the MCP server with authenticated requests');
  console.log('🚪 Run `npm run logout` to clear authentication');
  
} catch (error) {
  console.log('==================');
  console.log('❌ Login failed!');
  console.log('💥 Error:', error.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('   • Make sure your .env file is configured correctly');
  console.log('   • Check that Chrome browser is installed');
  console.log('   • Verify your network connection');
  console.log('   • Try running `npm run logout` first to clear any cached tokens');
  console.log('');
  console.log('📖 For more help, check the authentication configuration in your .env file');
  
  process.exit(1);
}
