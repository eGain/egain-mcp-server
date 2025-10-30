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
  
  // Optional verbose diagnostics
  if (process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.log('\n🧵 Stack (debug):');
    console.log(error?.stack || '(no stack)');
  }
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('   • Ensure your .env is configured with required OAuth values');
  console.log('   • Check that Chrome browser is installed and reachable');
  console.log('   • Verify your network and VPN/proxy settings');

  // Targeted guidance based on the error content
  const msg = String(error?.message || '').toLowerCase();
  if (msg.includes('public client') || msg.includes('aadb2c90084')) {
    console.log('   • Detected public-client error: remove CLIENT_SECRET for a public PKCE app');
  } else if (msg.includes('no client_secret available') || msg.includes('confidential')) {
    console.log('   • Detected confidential-client flow without secret: set CLIENT_SECRET or configure the app as public');
  }
  if (msg.includes('invalid_client')) {
    console.log('   • invalid_client: verify CLIENT_ID is correct and app registration exists/enabled');
  }
  if (msg.includes('redirect_uri')) {
    console.log('   • redirect_uri mismatch: ensure REDIRECT_URL exactly matches the app registration');
  }
  if (msg.includes('401')) {
    console.log('   • 401 Unauthorized: check ACCESS_TOKEN_URL, AUTH_URL domain/tenant and credentials');
  }

  // Quick environment validation summary (mask sensitive values)
  const requiredVars = ['EGAIN_URL','AUTH_URL','ACCESS_TOKEN_URL','CLIENT_ID','REDIRECT_URL'];
  const optionalVars = ['CLIENT_SECRET','SCOPE_PREFIX'];
  const mask = (k, v) => {
    if (!v) return '(missing)';
    if (k === 'CLIENT_SECRET') return v.slice(0, 4) + '…';
    if (k === 'CLIENT_ID') return v.slice(0, 8) + '…';
    try {
      if (k.endsWith('_URL')) {
        const u = new URL(v);
        return `${u.origin}${u.pathname}`;
      }
    } catch {}
    return v;
  };
  console.log('\n🧪 Env check:');
  for (const k of requiredVars) {
    console.log(`   - ${k}:`, mask(k, process.env[k]));
  }
  for (const k of optionalVars) {
    console.log(`   - ${k} (optional):`, mask(k, process.env[k]));
  }
  console.log('');
  console.log('📖 Required env keys: EGAIN_URL, AUTH_URL, ACCESS_TOKEN_URL, CLIENT_ID, REDIRECT_URL');
  console.log('   If the client is confidential, set CLIENT_SECRET. Otherwise, omit it for public PKCE.');
  console.log('   Run `node scripts/logout.js` then `node scripts/login.js` after updating .env in the root of this repo');
  
  process.exit(1);
}
