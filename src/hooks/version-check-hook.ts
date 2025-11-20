/**
 * Version Check Hook for eGain MCP Server
 * Checks for updates by comparing local version with latest version on npm
 */

import { SDKInitHook } from "./types.js";
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

/**
 * Compare two semantic version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

/**
 * Check if we're running from a git repository
 */
function isGitRepo(projectRoot: string): boolean {
  try {
    const gitDir = path.join(projectRoot, '.git');
    return fs.existsSync(gitDir) || fs.existsSync(path.join(projectRoot, '.git', 'HEAD'));
  } catch {
    return false;
  }
}

/**
 * Get local version from package.json
 */
function getLocalVersion(): string | null {
  try {
    const projectRoot = getProjectRoot();
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || null;
    }
  } catch (error) {
    console.error('⚠️  Could not read local version:', error);
  }
  
  return null;
}

/**
 * Fetch latest version from npm registry
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const packageName = '@egain/egain-mcp-server';
    const registryUrl = `https://registry.npmjs.org/${packageName}`;
    
    const response = await fetch(registryUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status}`);
    }
    
    const data = await response.json() as { 'dist-tags'?: { latest?: string } };
    return data['dist-tags']?.latest || null;
  } catch (error) {
    // Silently fail - network issues shouldn't block initialization
    return null;
  }
}

export class VersionCheckHook implements SDKInitHook {
  private checkPerformed = false;

  sdkInit(opts: SDKOptions): SDKOptions {
    // Only check once per SDK initialization
    if (this.checkPerformed) {
      return opts;
    }
    
    this.checkPerformed = true;
    
    // Perform version check asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        const localVersion = getLocalVersion();
        
        if (!localVersion) {
          console.error('⚠️  Could not determine local version');
          return;
        }
        
        console.error(`📦 Checking for updates (current version: ${localVersion})...`);
        
        const latestVersion = await getLatestVersion();
        
        if (!latestVersion) {
          // Silently fail - network issues shouldn't be noisy
          return;
        }
        
        if (compareVersions(latestVersion, localVersion) > 0) {
          const projectRoot = getProjectRoot();
          const isGit = isGitRepo(projectRoot);
          
          console.error('');
          console.error('⚠️  UPDATE AVAILABLE');
          console.error(`   Current version: ${localVersion}`);
          console.error(`   Latest version:  ${latestVersion}`);
          
          if (isGit) {
            console.error(`   Update with: git pull && npm run build`);
            console.error(`   Or visit: https://github.com/eGain/egain-mcp-server`);
          } else {
            console.error(`   Update with: npm install -g @egain/egain-mcp-server@latest`);
            console.error(`   Or visit: https://www.npmjs.com/package/@egain/egain-mcp-server`);
          }
          console.error('');
        } else {
          console.error(`✅ You are running the latest version (${localVersion})`);
        }
      } catch (error) {
        // Silently fail - version check shouldn't break initialization
        // Only log if it's a non-network error
        if (error instanceof Error && !error.message.includes('fetch')) {
          console.error('⚠️  Version check failed:', error.message);
        }
      }
    });
    
    return opts;
  }
}

