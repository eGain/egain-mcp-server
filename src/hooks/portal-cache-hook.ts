/**
 * Portal Cache Hook for eGain MCP Server
 * Caches portal names and IDs using v4 API after authentication
 */

// Configuration: Change this to match your API domain
const API_DOMAIN = 'api-dev9.knowledge.ai';

import { BeforeCreateRequestHook, BeforeCreateRequestContext, SDKInitHook } from "./types.js";
import { RequestInput } from "../lib/http.js";
import { SDKOptions } from "../lib/config.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

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

interface Portal {
  id: string;
  name: string;
}

// Always use project root for cache file
const getCacheFilePath = (): string => {
  const projectRoot = getProjectRoot();
  const cachePath = path.join(projectRoot, 'portals_cache.json');
  
  console.error(`📁 Using cache file in project directory: ${cachePath}`);
  
  // Ensure the directory exists (it should, since it's project root)
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.error(`⚠️  Could not ensure cache directory exists: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return cachePath;
};

const PORTALS_CACHE_FILE = getCacheFilePath();

export class PortalCacheHook implements SDKInitHook, BeforeCreateRequestHook {
  private portalCache: Map<string, string> = new Map(); // name -> id mapping
  private cacheInitialized: boolean = false;
  private cachePromise: Promise<void> | null = null;

  constructor() {
    console.error('🏗️  CACHE: PortalCacheHook constructor called');
    // Try to load from cache file immediately on construction
    this.loadFromCacheFileIfExists();
    console.error(`🏗️  CACHE: PortalCacheHook constructor completed. Cache size: ${this.portalCache.size}, initialized: ${this.cacheInitialized}`);
  }

  // SDKInit hook - initialize portal cache early during SDK initialization
  sdkInit(opts: SDKOptions): SDKOptions {
    console.error('🚀 CACHE: Portal cache SDKInit hook called - preparing for early initialization');
    
    // Always ensure we try to load from cache file during SDK init
    if (!this.cacheInitialized) {
      this.loadFromCacheFileIfExists();
    }
    
    // If we already have cached portals from file, mark as initialized
    if (this.portalCache.size > 0) {
      this.cacheInitialized = true;
      console.error(`✅ CACHE: Portal cache initialized from file with ${this.portalCache.size} entries`);
      console.error(`🔍 CACHE: Cache includes portals: ${Array.from(this.portalCache.keys()).slice(0, 10).join(', ')}`);
    } else {
      console.error('⚠️  CACHE: No cached portals found during SDK init, will need to fetch during first request');
      // Start async initialization in background if we have bearer token
      this.startBackgroundInitialization();
    }
    
    return opts;
  }

  private startBackgroundInitialization(): void {
    // Try to get bearer token from file system to start initialization early
    const projectRoot = getProjectRoot();
    const bearerTokenPath = path.join(projectRoot, '.bearer_token');
    try {
      if (fs.existsSync(bearerTokenPath)) {
        const bearerToken = fs.readFileSync(bearerTokenPath, 'utf8').trim();
        if (bearerToken) {
          console.error('🔄 CACHE: Found existing bearer token, starting background cache initialization...');
          // Create a fake request for background initialization
          const fakeRequest = new Request(`https://${API_DOMAIN}/knowledge`, {
            headers: { 'Authorization': `Bearer ${bearerToken}` }
          });
          
          // Start initialization without blocking
          this.ensureCacheInitialized(fakeRequest).catch(error => {
            console.error('⚠️  CACHE: Background initialization failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('⚠️  CACHE: Could not start background initialization:', error);
    }
  }

  private loadFromCacheFileIfExists(): void {
    try {
      const portals = this.loadPortalsFromCache();
      if (portals && portals.length > 0) {
        // Build the in-memory cache from file
        this.portalCache.clear();
        for (const portal of portals) {
          if (portal.name && portal.id) {
            // Store both exact name and lowercase name for flexible matching
            this.portalCache.set(portal.name, portal.id);
            this.portalCache.set(portal.name.toLowerCase(), portal.id);
          }
        }
        this.cacheInitialized = true;
        console.error(`🚀 CACHE: Portal cache pre-loaded with ${portals.length} portals from cache file`);
      } else {
        console.error(`⚠️  CACHE: No portals loaded from cache file (portals: ${portals ? portals.length : 'null'})`);
      }
    } catch (error) {
      console.error('⚠️  Failed to pre-load portal cache from file:', error);
    }
  }

  private async fetchPortals(bearerToken: string): Promise<Portal[]> {
    try {
      const allPortals: Portal[] = [];
      let currentPage = 1;
      const pageSize = 25; // Max page size
      const maxPages = 99; // Safety limit
      
      const headers = {
        "Authorization": `Bearer ${bearerToken}`,
        "Accept-Language": "en-US",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "speakeasy-sdk/mcp-typescript 0.1.20 2.721.0 4.0.0 test-knowledge-mcp"
      };

      // Temporarily disable SSL verification for development/testing
      const originalRejectUnauthorized = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

      try {
        while (currentPage <= maxPages) {
          const v4ApiUrl = `https://${API_DOMAIN}/knowledge/portalmgr/v4/myportals?$lang=en-US&$pagenum=${currentPage}&$pagesize=${pageSize}`;
          
          console.error(`🔍 CACHE: Fetching portals from v4 API (page ${currentPage}): ${v4ApiUrl}`);
          
          const response = await fetch(v4ApiUrl, {
            method: 'GET',
            headers
          });

          console.error(`📨 v4 API Response Status (page ${currentPage}): ${response.status} ${response.statusText}`);
          //console.error(`📨 v4 API Response Headers (page ${currentPage}):`, Object.fromEntries(response.headers.entries()));

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ v4 API failed on page ${currentPage}: ${response.status} - ${errorText}`);
            console.error(`❌ Full error response body:`, errorText);
            throw new Error(`Failed to fetch portals page ${currentPage}: ${response.status} ${response.statusText}`);
          }

          const responseText = await response.text();
          //console.error(`📋 v4 API Response Body (page ${currentPage}) - Length: ${responseText.length} chars`);
          //console.error(`📋 v4 API Response Body Preview (page ${currentPage}): ${responseText.substring(0, 500)}...`);
          
          // Also log the full response if it's not too large
          if (responseText.length < 2000) {
            console.error(`📋 v4 API Full Response Body (page ${currentPage}):`, responseText);
          }
          
          const data = JSON.parse(responseText);
          
          // Log the parsed JSON structure
          console.error(`🔍 v4 API Parsed JSON structure (page ${currentPage}):`, {
            hasPortalArray: !!(data && data.portal && Array.isArray(data.portal)),
            portalCount: data?.portal?.length || 0,
            topLevelKeys: data ? Object.keys(data) : [],
            firstPortalKeys: data?.portal?.[0] ? Object.keys(data.portal[0]) : []
          });
          
          // Extract portals from current page
          if (data && data.portal && Array.isArray(data.portal)) {
            const pagePortals = data.portal.map((portal: any) => ({
              id: portal.id?.toString() || '',
              name: portal.name || ''
            })).filter((portal: Portal) => portal.id && portal.name);
            
            allPortals.push(...pagePortals);
          } else {
            console.error(`❌ Unexpected v4 API response structure on page ${currentPage}:`, data);
            break;
          }

          // Check pagination info to see if there are more pages
          const paginationInfo = data.paginationInfo;
          if (paginationInfo) {
            const totalCount = paginationInfo.count || 0;
            const currentPageNum = paginationInfo.pagenum || currentPage;
            const currentPageSize = paginationInfo.pagesize || pageSize;
            
            console.error(`📄 CACHE: Pagination info - Total: ${totalCount}, Page: ${currentPageNum}, Size: ${currentPageSize}`);
            
            // Check if we have a "next" link or if we've reached the end
            const hasNextPage = paginationInfo.link && 
              paginationInfo.link.some((link: any) => link.rel === 'next');
            
            if (!hasNextPage) {
              break;
            }
            
            // Also check if we've reached the total count
            if (allPortals.length >= totalCount) {
              console.error(`✅ CACHE: Fetched all ${totalCount} portals. Stopping pagination.`);
              break;
            }
          } else {
            break;
          }

          currentPage++;
        }
      } finally {
        // Restore original SSL setting
        if (originalRejectUnauthorized !== undefined) {
          process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalRejectUnauthorized;
        } else {
          delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
        }
      }

      console.error(`✅ CACHE: Successfully fetched ${allPortals.length} portals across ${currentPage - 1} pages`);
      return allPortals;
    } catch (error) {
      console.error('❌ Error fetching portals:', error);
      return [];
    }
  }

  private savePortalsToCache(portals: Portal[]): void {
    try {
      if (portals.length > 0) {
        fs.writeFileSync(PORTALS_CACHE_FILE, JSON.stringify(portals, null, 4));
        console.error(`💾 CACHE: Saved ${portals.length} portals to cache file: ${PORTALS_CACHE_FILE}`);
      } else {
        console.error('⚠️  No valid portals data to save');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EROFS') {
        console.error('⚠️  File system is read-only, continuing with in-memory cache only');
        console.error(`💭 ${portals.length} portals cached in memory (cannot persist to disk)`);
      } else {
        console.error('❌ Error saving portals to cache:', error);
      }
      // Don't throw - continue with in-memory cache even if disk save fails
    }
  }

  private loadPortalsFromCache(): Portal[] | null {
    try {
      if (fs.existsSync(PORTALS_CACHE_FILE)) {
        const data = fs.readFileSync(PORTALS_CACHE_FILE, 'utf8');
        console.error(`📄 CACHE: Read ${data.length} characters from cache file`);
        const portals = JSON.parse(data) as Portal[];
        console.error(`📂 CACHE: Parsed ${portals.length} portals from cache file`);
        return portals;
      } else {
        console.error(`❌ CACHE: Cache file does not exist: ${PORTALS_CACHE_FILE}`);
      }
    } catch (error) {
      console.error('❌ Error loading portals from cache:', error);
    }
    return null;
  }

  private async initializeCache(_context: BeforeCreateRequestContext, request: Request): Promise<void> {
    if (this.cacheInitialized) {
      return;
    }

    // Prevent multiple concurrent cache initializations
    if (this.cachePromise) {
      await this.cachePromise;
      return;
    }

    this.cachePromise = (async () => {
      try {
        console.error('🏗️  CACHE: Initializing portal cache...');
        
        // Check if cache is already loaded from constructor
        if (this.portalCache.size > 0) {
          console.error('✅ CACHE: Portal cache already loaded from file during construction');
          this.cacheInitialized = true;
          return;
        }

        // Try to load from cache first (if not already loaded in constructor)
        let portals = this.loadPortalsFromCache();
        
        if (!portals || portals.length === 0) {
          console.error('📥 CACHE: Cache is empty or does not exist. Fetching new data...');
          
          // Extract bearer token from request headers
          const authHeader = request.headers.get('Authorization');
          const bearerToken = authHeader?.replace('Bearer ', '') || '';
          
          if (!bearerToken) {
            console.error('❌ CACHE: No bearer token found in request headers');
            return;
          }
          
          // Fetch portals from API
          portals = await this.fetchPortals(bearerToken);
          
          if (portals && portals.length > 0) {
            // Save to cache file
            this.savePortalsToCache(portals);
          } else {
            console.error('❌ CACHE: Failed to fetch portals from API');
            return;
          }
        }
        
        // Build the in-memory cache
        this.portalCache.clear();
        for (const portal of portals) {
          if (portal.name && portal.id) {
            // Store both exact name and lowercase name for flexible matching
            this.portalCache.set(portal.name, portal.id);
            this.portalCache.set(portal.name.toLowerCase(), portal.id);
          }
        }

        console.error(`✅ Portal cache initialized with ${portals.length} portals`);
        if (portals.length > 0) {
          console.error('📋 Available portals:', portals.map(p => `${p.name} (${p.id})`).join(', '));
        }

        this.cacheInitialized = true;
      } catch (error) {
        console.error('❌ Failed to initialize portal cache:', error);
        // Don't throw - we'll continue without cache
      }
    })();

    await this.cachePromise;
  }

  public getPortalId(portalName: string): string | null {
    // Allow portal lookups even if not officially "initialized" but we have cached data
    if (!this.cacheInitialized && this.portalCache.size === 0) {
      return null;
    }
    
    // Try exact match first
    const exactMatch = this.portalCache.get(portalName) || this.portalCache.get(portalName.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }
    
    // If no exact match, try partial matching (like Python version)
    // Look for portal names that contain the search term
    const searchTerm = portalName.toLowerCase();
    for (const [cachedName, id] of this.portalCache.entries()) {
      if (cachedName.toLowerCase().includes(searchTerm)) {
        console.error(`🔄 Found partial match: "${portalName}" -> "${cachedName}" (${id})`);
        return id;
      }
    }
    
    // If still no match, list available portals for debugging
    console.error(`⚠️  Portal name "${portalName}" not found in cache. Available portals:`, 
      this.getAvailablePortals().map(p => p.name).join(', '));
    
    return null;
  }

  public getAvailablePortals(): Array<{name: string, id: string}> {
    const portals: Array<{name: string, id: string}> = [];
    const addedIds = new Set<string>();
    
    for (const [name, id] of this.portalCache.entries()) {
      // Avoid duplicates (since we store both original and lowercase names)
      if (!addedIds.has(id)) {
        portals.push({ name, id });
        addedIds.add(id);
      }
    }
    
    return portals;
  }

  public getMasterPortalId(): string | null {
    const masterPortalId = this.getPortalId("Master Portal");
    if (!masterPortalId) {
      console.error('❌ "Master Portal" not found. Cannot provide default portal.');
      return null;
    }
    return masterPortalId;
  }

  public isCacheInitialized(): boolean {
    return this.cacheInitialized;
  }

  public isCacheInitializing(): boolean {
    return this.cachePromise !== null && !this.cacheInitialized;
  }

  public async waitForCacheInitialization(): Promise<void> {
    if (this.cachePromise) {
      await this.cachePromise;
    }
  }

  // BeforeCreateRequestHook - ensures cache is ready before request creation (synchronous)
  beforeCreateRequest(_hookCtx: BeforeCreateRequestContext, input: RequestInput): RequestInput {

    // Check if cache is ready
    const availablePortals = this.getAvailablePortals();
    const cacheReady = this.cacheInitialized || availablePortals.length > 0;
    
    if (!cacheReady) {
      console.error('❌ CACHE: Portal cache not ready during request creation - this should not happen!');
      console.error('🐛 CACHE: This indicates a bug in the cache initialization logic');
      
      // Don't start background initialization here - it should have been started in sdkInit
      if (!this.cachePromise) {
        console.error('⚠️  CACHE: No cache initialization in progress - this may cause issues');
      }
    } else {
      console.error(`✅ CACHE: Portal cache ready with ${availablePortals.length} portals for request processing`);
    }

    // ALWAYS return the input unchanged - never fail request creation
    return input;
  }


  // Public method to manually initialize cache if needed (e.g., called by auth hook when token is available)
  public async ensureCacheInitialized(request: Request): Promise<void> {
    if (!this.cacheInitialized && !this.cachePromise) {
      console.error('🔧 Manual cache initialization requested...');
      // Create a minimal context for manual initialization
      const context: BeforeCreateRequestContext = {
        operationID: "manual_init",
        baseURL: "",
        oAuth2Scopes: [],
        retryConfig: { strategy: "backoff", backoff: { initialInterval: 500, maxInterval: 5000, maxElapsedTime: 30000, exponent: 1.5 } },
        resolvedSecurity: null,
        options: {}
      };
      await this.initializeCache(context, request);
    } else if (this.cachePromise) {
      console.error('🔧 Cache initialization already in progress, waiting...');
      await this.cachePromise;
    } else {
      console.error('🔧 Cache already initialized, no action needed');
    }
  }

  // Method to force refresh the cache (useful when auth hook gets a fresh token)
  public async refreshCacheWithToken(bearerToken: string): Promise<void> {
    console.error('🔄 Forcing cache refresh with new token...');
    // Reset the cache state to force a fresh fetch
    this.cacheInitialized = false;
    this.cachePromise = null;
    this.portalCache.clear();

    // Create a fake request with the bearer token
    const fakeRequest = new Request(`https://${API_DOMAIN}/knowledge`, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });

    await this.ensureCacheInitialized(fakeRequest);
  }
}
