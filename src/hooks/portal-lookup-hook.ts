/**
 * Portal Lookup Hook for eGain MCP Server
 * Translates portal names to portal IDs in request parameters before sending requests
 */

import { BeforeRequestHook, BeforeRequestContext } from "./types.js";
import { PortalCacheHook } from "./portal-cache-hook.js";

export class PortalLookupHook implements BeforeRequestHook {
  constructor(private portalCache: PortalCacheHook) {}

  private translatePortalName(portalName: string): string | null {
    // Skip if it's already a numeric ID
    if (/^\d+$/.test(portalName)) {
      return null; // Already an ID, no translation needed
    }

    // Check cache readiness using the same logic as beforeCreateRequest
    const availablePortals = this.portalCache.getAvailablePortals();
    const cacheInitialized = this.portalCache.isCacheInitialized();
    const cacheReady = cacheInitialized || availablePortals.length > 0;

    if (!cacheReady) {
      const isInitializing = this.portalCache.isCacheInitializing();
      if (isInitializing) {
        console.error(`⚠️  LOOKUP: Portal cache still initializing, cannot translate portal name: "${portalName}"`);
        console.error('💡 LOOKUP: Race condition detected - cache initialization in progress');
      } else {
        console.error(`⚠️  LOOKUP: Portal cache not ready, cannot translate portal name: "${portalName}"`);
      }
      return null;
    }

    // Try exact match first
    let portalId = this.portalCache.getPortalId(portalName);
    
    if (portalId) {
      console.error(`✅ LOOKUP: Exact match found "${portalName}" -> "${portalId}"`);
      return portalId;
    }

    // Try fuzzy matching if exact match fails
    portalId = this.fuzzyMatchPortal(portalName, availablePortals);
    
    if (portalId) {
      console.error(`✅ LOOKUP: Fuzzy match found for "${portalName}" -> "${portalId}"`);
    } else {
      console.error(`⚠️  LOOKUP: Portal name "${portalName}" not found in cache. Available portals:`, 
        availablePortals.map(p => p.name).join(', '));
    }

    return portalId;
  }

  private fuzzyMatchPortal(searchName: string, availablePortals: Array<{id: string, name: string}>): string | null {
    const normalizedSearch = searchName.toLowerCase().trim();
    
    // Remove common suffixes/prefixes that might differ
    const cleanSearch = normalizedSearch
      .replace(/\s*portal\s*$/i, '')
      .replace(/^portal\s*/i, '')
      .trim();
    
    for (const portal of availablePortals) {
      const normalizedPortal = portal.name.toLowerCase().trim();
      const cleanPortal = normalizedPortal
        .replace(/\s*portal\s*$/i, '')
        .replace(/^portal\s*/i, '')
        .trim();
      
      // Try various matching strategies
      if (
        // Exact match after cleaning
        cleanSearch === cleanPortal ||
        // Contains match (search contains portal name or vice versa)
        cleanSearch.includes(cleanPortal) ||
        cleanPortal.includes(cleanSearch) ||
        // Partial word match
        this.wordsMatch(cleanSearch, cleanPortal)
      ) {
        console.error(`🎯 LOOKUP: Fuzzy matched "${searchName}" -> "${portal.name}" (${portal.id})`);
        return portal.id;
      }
    }
    
    return null;
  }

  private wordsMatch(search: string, target: string): boolean {
    const searchWords = search.split(/\s+/).filter(w => w.length > 2);
    const targetWords = target.split(/\s+/).filter(w => w.length > 2);
    
    // If either has significant words, check if any match
    if (searchWords.length > 0 && targetWords.length > 0) {
      return searchWords.some(sw => 
        targetWords.some(tw => 
          sw.includes(tw) || tw.includes(sw)
        )
      );
    }
    
    return false;
  }

  // Get default portal ID (only from cache, no hard-coded fallbacks)
  private getDefaultPortalId(): string | null {
    // Try common default portal names from cache only
    const defaultPortalNames = ['Master Portal'];
    
    for (const defaultName of defaultPortalNames) {
      const portalId = this.translatePortalName(defaultName);
      if (portalId) {
        console.error(`🎯 LOOKUP: Using default portal "${defaultName}" -> ${portalId}`);
        return portalId;
      }
    }
    
    console.error('⚠️  LOOKUP: No default portal found in cache');
    return null;
  }

  // Get portal name from ID (reverse lookup)
  private getPortalNameFromId(portalId: string): string | null {
    const availablePortals = this.portalCache.getAvailablePortals();
    for (const portal of availablePortals) {
      if (portal.id === portalId) {
        return portal.name;
      }
    }
    
    return null;
  }


  async beforeRequest(_hookCtx: BeforeRequestContext, request: Request): Promise<Request> {
    // console.error('🔍 LOOKUP: ===== PORTAL LOOKUP HOOK TRIGGERED =====');
    // console.error('🔍 LOOKUP: Request URL:', request.url);
    // console.error('🔍 LOOKUP: Request method:', request.method);
    

    // Check if cache is ready (should be ready from SDKInit)
    
    // Check if URL contains portal name in path (e.g., /portals/{portalName}/)
    const urlObj = new URL(request.url);
    // console.error('🔍 LOOKUP: Full URL:', request.url);
    // console.error('🔍 LOOKUP: URL pathname:', urlObj.pathname);
    // console.error('🔍 LOOKUP: Testing regex /\\/portals\\/([^\\/]+)/ against pathname...');
    
    const portalPathMatch = urlObj.pathname.match(/\/portals\/([^\/]+)/);
    // console.error('🔍 LOOKUP: Regex match result:', portalPathMatch);
    
    if (portalPathMatch && portalPathMatch[1]) {
      const portalNameInPath = portalPathMatch[1];
      
      // Check if it's already a proper portal ID
      const portalIdPattern = /^[a-zA-Z0-9]{2,4}-\d{4,15}$/;
      if (!portalIdPattern.test(portalNameInPath)) {
        console.error(`🔍 LOOKUP: Portal name "${portalNameInPath}" in URL path needs translation...`);
        
        // Get cache info
        const availablePortals = this.portalCache.getAvailablePortals();
        const cacheInitialized = this.portalCache.isCacheInitialized();
        const cacheReady = cacheInitialized || availablePortals.length > 0;
        
        if (!cacheReady) {
          console.error(`⚠️  LOOKUP: Cache not ready, cannot translate portal name "${portalNameInPath}" from URL path`);
          // Don't return here - let it continue to wait for cache initialization
        } else {
          const translatedPortalId = this.translatePortalName(portalNameInPath);
          if (translatedPortalId) {
            console.error(`🔄 LOOKUP: SUCCESS! Translating URL path: "${portalNameInPath}" -> "${translatedPortalId}"`);
            
            // Replace portal name in URL path with portal ID
            const newPathname = urlObj.pathname.replace(`/portals/${portalNameInPath}`, `/portals/${translatedPortalId}`);
            urlObj.pathname = newPathname;
            
            console.error(`🔄 LOOKUP: Original URL: ${request.url}`);
            console.error(`🔄 LOOKUP: Modified URL: ${urlObj.toString()}`);
            
            // Create new request with modified URL
            const newRequest = new Request(urlObj.toString(), {
              method: request.method,
              headers: request.headers,
              body: request.body
            });
            
            console.error(`🔄 LOOKUP: ===== RETURNING MODIFIED REQUEST (URL PATH) =====`);
            return newRequest;
          } else {
            console.error(`❌ LOOKUP: Failed to translate portal name "${portalNameInPath}" from URL path`);
          }
        }
      } else {
        console.error(`✅ LOOKUP: Portal ID "${portalNameInPath}" in URL path already in correct format`);
      }
    }
    
    // If cache is initializing, wait for it to complete
    if (this.portalCache.isCacheInitializing()) {
      console.error('⏳ LOOKUP: Cache is initializing, waiting for completion...');
      await this.portalCache.waitForCacheInitialization();
      console.error('✅ LOOKUP: Cache initialization completed');
      
      // Re-check URL translation now that cache is ready
      const portalPathMatch = urlObj.pathname.match(/\/portals\/([^\/]+)/);
      if (portalPathMatch && portalPathMatch[1]) {
        const portalNameInPath = portalPathMatch[1];
        const portalIdPattern = /^[a-zA-Z0-9]{2,4}-\d{4,15}$/;
        
        if (!portalIdPattern.test(portalNameInPath)) {
          console.error(`🔄 LOOKUP: Re-checking URL translation after cache initialization for: "${portalNameInPath}"`);
          
          const translatedPortalId = this.translatePortalName(portalNameInPath);
          if (translatedPortalId) {
            console.error(`🔄 LOOKUP: SUCCESS! Post-cache translating URL path: "${portalNameInPath}" -> "${translatedPortalId}"`);
            
            // Replace portal name in URL path with portal ID
            const newPathname = urlObj.pathname.replace(`/portals/${portalNameInPath}`, `/portals/${translatedPortalId}`);
            urlObj.pathname = newPathname;
            
            console.error(`🔄 LOOKUP: Original URL: ${request.url}`);
            console.error(`🔄 LOOKUP: Modified URL: ${urlObj.toString()}`);
            
            // Create new request with modified URL
            const newRequest = new Request(urlObj.toString(), {
              method: request.method,
              headers: request.headers,
              body: request.body
            });
            
            // console.error(`🔄 LOOKUP: ===== RETURNING MODIFIED REQUEST (POST-CACHE) =====`);
            return newRequest;
          } else {
            console.error(`❌ LOOKUP: Post-cache translation failed for portal name "${portalNameInPath}"`);
          }
        }
      }
    }
    
    const availablePortals = this.portalCache.getAvailablePortals();
    const cacheReady = this.portalCache.isCacheInitialized() || availablePortals.length > 0;
    
    if (!cacheReady) {
      console.error('⚠️  LOOKUP: Portal cache not ready, using fallback behavior');
      console.error('💡 LOOKUP: Will use portalId as-is and attempt minimal translation');
      // Don't return early - try to do what we can with the request
    }
    
    console.error(`📂 LOOKUP: Portal cache ready with ${availablePortals.length} portals, proceeding with translation`);
    
    // Process request body for portal name translation
    if (request.headers.get('content-type')?.includes('application/json')) {
      try {
        // Clone the request to avoid "already used" error
        const clonedRequest = request.clone();
        const body = await clonedRequest.text();
        if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
          const parsedJson = JSON.parse(body);
          let bodyModified = false;
          
          
          // Check for both portalID (uppercase D) and portalId (lowercase d)
          const currentPortalId = parsedJson.portalID || parsedJson.portalId;
          
          // Log current portal lookup context
          if (parsedJson.channel && parsedJson.channel.name) {
            console.error(`🎯 LOOKUP: Portal name detected in channel.name: "${parsedJson.channel.name}"`);
          } else if (parsedJson.channel && parsedJson.channel.type === 'portal') {
            console.error(`⚠️  LOOKUP: Channel type is "portal" but no channel.name provided for lookup`);
          } else {
            console.error(`📋 LOOKUP: No portal name in channel.name, will use portalID as-is: ${currentPortalId}`);
          }
          
          // Process portal_name in JSON body
          if (parsedJson.portal_name && typeof parsedJson.portal_name === 'string') {
            const portalId = this.translatePortalName(parsedJson.portal_name);
            if (portalId) {
              console.error(`🔄 LOOKUP: Translated JSON field portal_name: "${parsedJson.portal_name}" -> portal_id: "${portalId}"`);
              parsedJson.portal_id = portalId;
              delete parsedJson.portal_name;
              bodyModified = true;
            }
          }

          // Process portalID field (MCP tools use uppercase D)
          
          if (parsedJson.portalID && typeof parsedJson.portalID === 'string') {
            
            // Check if portalID doesn't match the expected pattern (prefix-digits)
            const portalIdPattern = /^[a-zA-Z0-9]{2,4}-\d{4,15}$/;
            const patternMatches = portalIdPattern.test(parsedJson.portalID);
            
            if (!patternMatches) {
              
              const translatedPortalId = this.translatePortalName(parsedJson.portalID);
              console.error(`🔍 LOOKUP: Translation result: "${translatedPortalId}"`);
              
              if (translatedPortalId) {
                console.error(`🔄 LOOKUP: SUCCESS! Translated portalID: "${parsedJson.portalID}" -> "${translatedPortalId}"`);
                console.error(`🔄 LOOKUP: BEFORE assignment - parsedJson.portalID = "${parsedJson.portalID}"`);
                parsedJson.portalID = translatedPortalId;
                console.error(`🔄 LOOKUP: AFTER assignment - parsedJson.portalID = "${parsedJson.portalID}"`);
                bodyModified = true;
                console.error(`🔄 LOOKUP: bodyModified set to: ${bodyModified}`);
              } else {
                console.error(`❌ LOOKUP: Failed to translate portalID "${parsedJson.portalID}". Available portals: ${availablePortals.map(p => p.name).slice(0, 5).join(', ')}${availablePortals.length > 5 ? '...' : ''}`);
              }
            } else {
              console.error(`✅ LOOKUP: portalID "${parsedJson.portalID}" already in correct format, no translation needed`);
            }
          }

          // Process portalId field (lowercase d for compatibility)
          if (parsedJson.portalId && typeof parsedJson.portalId === 'string') {
            // Check if portalId doesn't match the expected pattern (prefix-digits)
            const portalIdPattern = /^[a-zA-Z0-9]{2,4}-\d{4,15}$/;
            if (!portalIdPattern.test(parsedJson.portalId)) {
              console.error(`🔍 LOOKUP: portalId "${parsedJson.portalId}" doesn't match expected pattern, attempting translation...`);
              const translatedPortalId = this.translatePortalName(parsedJson.portalId);
              if (translatedPortalId) {
                console.error(`🔄 LOOKUP: Translated portalId: "${parsedJson.portalId}" -> "${translatedPortalId}"`);
                parsedJson.portalId = translatedPortalId;
                bodyModified = true;
              } else {
                console.error(`❌ LOOKUP: Failed to translate portalId "${parsedJson.portalId}". Available portals: ${availablePortals.map(p => p.name).slice(0, 5).join(', ')}${availablePortals.length > 5 ? '...' : ''}`);
              }
            } else {
              console.error(`✅ LOOKUP: portalId "${parsedJson.portalId}" already in correct format, no translation needed`);
            }
          }

          // Process channel.name in JSON body (for eGain requests)
          if (parsedJson.channel && 
              typeof parsedJson.channel === 'object' && 
              parsedJson.channel.name && 
              typeof parsedJson.channel.name === 'string') {
            const portalId = this.translatePortalName(parsedJson.channel.name);
            if (portalId) {
              console.error(`🔄 LOOKUP: Translated JSON field channel.name: "${parsedJson.channel.name}" -> portalId: "${portalId}"`);
              parsedJson.portalId = portalId;
              bodyModified = true;
            } else {
              console.error(`❌ LOOKUP: Failed to translate portal name "${parsedJson.channel.name}". Available portals: ${availablePortals.map(p => p.name).slice(0, 5).join(', ')}${availablePortals.length > 5 ? '...' : ''}`);
              console.error(`💡 LOOKUP: Make sure the portal name matches exactly or use fuzzy matching patterns`);
            }
          }

          // Process portalId if it's 1 (default/placeholder) and we have channel info
          if (parsedJson.portalId === 1 && 
              parsedJson.channel && 
              typeof parsedJson.channel === 'object' && 
              parsedJson.channel.name && 
              typeof parsedJson.channel.name === 'string') {
            const portalId = this.translatePortalName(parsedJson.channel.name);
            if (portalId) {
              console.error(`🔄 LOOKUP: Replaced default portalId: 1 with "${parsedJson.channel.name}" -> portalId: "${portalId}"`);
              parsedJson.portalId = portalId;
              bodyModified = true;
            }
          }

          // Handle case where channel.type is "portal" but no channel.name is provided
          if (parsedJson.portalId === 1 && 
              parsedJson.channel && 
              typeof parsedJson.channel === 'object' && 
              parsedJson.channel.type === 'portal' && 
              !parsedJson.channel.name) {
            console.error('⚠️  LOOKUP: Portal type="portal" specified but no channel.name provided for lookup');
            if (cacheReady) {
              // Try to get a default portal from cache
              const portalId = this.getDefaultPortalId();
              if (portalId) {
                const portalName = this.getPortalNameFromId(portalId) || 'Default Portal';
                console.error(`🔄 LOOKUP: No portal name provided, using default portal: "${portalName}" -> portalId: "${portalId}"`);
                parsedJson.portalId = portalId;
                // Also set the channel name for clarity
                parsedJson.channel.name = portalName;
                bodyModified = true;
              } else {
                console.error('❌ LOOKUP: No portal name provided and no default portal available in cache');
                console.error('💡 LOOKUP: Please specify channel.name with a valid portal name (e.g., "eBrain")');
              }
            } else {
              // Cache not ready - cannot proceed without cache
              console.error('❌ LOOKUP: Cache not ready and no default portal available');
              console.error('💡 LOOKUP: Portal cache must be initialized before making requests');
            }
          }

          // Handle case where portalId is a placeholder value (like 100) that needs translation
          if ((parsedJson.portalId === 100 || parsedJson.portalId === 1) && 
              parsedJson.channel && 
              typeof parsedJson.channel === 'object' && 
              parsedJson.channel.type === 'portal' && 
              !cacheReady) {
            console.error('❌ LOOKUP: Cache not ready and portalId needs translation - cannot proceed without cache');
            console.error('💡 LOOKUP: Please ensure portal cache is initialized before making requests');
            // Don't use hardcoded fallbacks - let the request fail properly
          }
          
          if (bodyModified) {
            const newBody = JSON.stringify(parsedJson);
            // console.error(`🔄 LOOKUP: ===== REQUEST BODY MODIFIED =====`);
            // console.error(`🔄 LOOKUP: Original body: ${body}`);
            // console.error(`🔄 LOOKUP: Modified body: ${newBody}`);
            // console.error(`🔄 LOOKUP: Creating new request with modified body...`);
            
            const newRequest = new Request(request.url, {
              method: request.method,
              headers: request.headers,
              body: newBody
            });
            
            console.error(`🔄 LOOKUP: ===== RETURNING MODIFIED REQUEST =====`);
            return newRequest;
          } else {
            // console.error(`🔄 LOOKUP: No modifications made to request body`);
            // console.error('⚠️  Request body NOT modified. Final request will use original portalId:', parsedJson.portalId || parsedJson.portalID);
          }
        }
      } catch (error) {
        console.error('Failed to parse JSON body for portal translation:', error);
      }
    }

    console.error(`🔄 LOOKUP: ===== RETURNING ORIGINAL REQUEST =====`);
    return request;
  }
}
