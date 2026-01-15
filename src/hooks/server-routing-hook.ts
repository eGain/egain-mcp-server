import { BeforeCreateRequestContext, BeforeCreateRequestHook } from "./types.js";
import { RequestInput } from "../lib/http.js";

/**
 * Server Routing Hook
 * 
 * Automatically routes operations to the correct API server:
 * - Most operations → Portal Manager API (server_0): /knowledge/portalmgr/v4
 * - Answers & Retrieve → AI Services API (server_1): /core/aiservices/v4
 * 
 * Why this hook exists:
 * Speakeasy doesn't support automatic per-operation server routing.
 * Using operation-level servers in the OpenAPI spec breaks the --api-domain flag.
 * This hook provides transparent routing while keeping --api-domain functional.
 */
export class ServerRoutingHook implements BeforeCreateRequestHook {
  // Operations that need AI Services API
  private readonly aiServicesOperations = new Set([
    "getBestAnswer",
    "retrieveChunks",
  ]);

  beforeCreateRequest(
    hookCtx: BeforeCreateRequestContext,
    input: RequestInput
  ): RequestInput {
    const operationID = hookCtx.operationID;

    // Check if this operation needs AI Services API
    if (this.aiServicesOperations.has(operationID)) {
      console.error(`🔀 ROUTING: Operation "${operationID}" → AI Services API (/core/aiservices/v4)`);
      
      // Parse the URL
      const url = new URL(input.url);
      
      // Replace Portal Manager path with AI Services path
      if (url.pathname.includes('/knowledge/portalmgr/v4')) {
        url.pathname = url.pathname.replace(
          '/knowledge/portalmgr/v4',
          '/core/aiservices/v4'
        );
        
        console.error(`🔀 ROUTING: Rewritten URL: ${url.toString()}`);
        
        return {
          ...input,
          url,
        };
      } else {
        console.error(`⚠️  ROUTING: Expected /knowledge/portalmgr/v4 in URL but found: ${url.pathname}`);
      }
    }
    
    // All other operations stay on Portal Manager API (default)
    return input;
  }
}

