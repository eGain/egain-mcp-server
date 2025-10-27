import { Hooks } from "./types.js";
import { AuthenticationHook } from "./auth-hook.js";
import { PortalCacheHook } from "./portal-cache-hook.js";
import { PortalLookupHook } from "./portal-lookup-hook.js";
import { ServerRoutingHook } from "./server-routing-hook.js";

/*
 * This file is only ever generated once on the first generation and then is free to be modified.
 * Any hooks you wish to add should be registered in the initHooks function. Feel free to define them
 * in this file or in separate files in the hooks folder.
 */

export function initHooks(hooks: Hooks) {
  console.error('🚀 Initializing eGain MCP hooks...');
  
  // 1. Server Routing Hook - routes operations to correct API server
  // Register this FIRST before request creation so URLs are correct from the start
  const serverRoutingHook = new ServerRoutingHook();
  hooks.registerBeforeCreateRequestHook(serverRoutingHook);
  console.error('✅ ROUTING: Registered server routing hook for before create request');
  
  // 2. Portal Cache Hook - caches portal names/IDs after authentication
  // Create this so we can pass it to the auth hook
  const portalCacheHook = new PortalCacheHook();
  hooks.registerSDKInitHook(portalCacheHook); // Handles full initialization
  hooks.registerBeforeCreateRequestHook(portalCacheHook); // Synchronous readiness check only
  console.error('✅ CACHE: Registered portal cache hook for SDK init and before create request');

  // 3. Authentication Hook - handles login popup and token management
  // Pass portal cache hook reference so it can trigger cache initialization after auth
  const authHook = new AuthenticationHook(portalCacheHook);
  hooks.registerSDKInitHook(authHook);
  hooks.registerBeforeRequestHook(authHook); // Register for automatic token refresh
  console.error('✅ AUTH: Registered authentication hook for SDK init and before request');

  // 4. Portal Lookup Hook - translates portal names to IDs in requests
  // Now synchronous since cache is guaranteed ready after SDKInit
  const portalLookupHook = new PortalLookupHook(portalCacheHook);
  hooks.registerBeforeRequestHook(portalLookupHook); // Should be mostly synchronous now
  console.error('✅ LOOKUP: Registered portal lookup hook for before request');

  console.error('🎉 All eGain MCP hooks registered successfully!');
}
