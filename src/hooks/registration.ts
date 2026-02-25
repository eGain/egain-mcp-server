import { Hooks } from "./types.js";
import { AuthenticationHook } from "./auth-hook.js";
import { ServerRoutingHook } from "./server-routing-hook.js";
import { VersionCheckHook } from "./version-check-hook.js";

/*
 * This file is only ever generated once on the first generation and then is free to be modified.
 * Any hooks you wish to add should be registered in the initHooks function. Feel free to define them
 * in this file or in separate files in the hooks folder.
 */

export function initHooks(hooks: Hooks) {
  console.error('🚀 Initializing eGain MCP hooks...');
  
  // 0. Version Check Hook - checks for updates from npm
  // Register this FIRST so users see update notifications early
  const versionCheckHook = new VersionCheckHook();
  hooks.registerSDKInitHook(versionCheckHook);
  console.error('✅ VERSION: Registered version check hook for SDK init');
  
  // 1. Server Routing Hook - routes operations to correct API server
  // Register this FIRST before request creation so URLs are correct from the start
  const serverRoutingHook = new ServerRoutingHook();
  hooks.registerBeforeCreateRequestHook(serverRoutingHook);
  console.error('✅ ROUTING: Registered server routing hook for before create request');


  // 2. Authentication Hook - handles login popup and token management
  const authHook = new AuthenticationHook();
  hooks.registerSDKInitHook(authHook);
  hooks.registerBeforeRequestHook(authHook); // Register for automatic token refresh
  console.error('✅ AUTH: Registered authentication hook for SDK init and before request');

  console.error('🎉 All eGain MCP hooks registered successfully!');
}
