#!/usr/bin/env node

/**
 * Logout script for eGain MCP Server
 * Removes authentication tokens and cached data to force fresh login
 * 
 * Usage: 
 *   node scripts/logout.js
 *   OR make executable: chmod +x scripts/logout.js && ./scripts/logout.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory (where package.json is)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname); // Go up one level from scripts/ to project root

const filesToRemove = [
  '.bearer_token',
  '.bearer_token_metadata', 
  'portals_cache.json'
];

console.log('🚪 eGain MCP Logout');
console.log('==================');

let removedCount = 0;

for (const file of filesToRemove) {
  const filePath = path.join(projectRoot, file);
  try {
    fs.unlinkSync(filePath);
    console.log(`✅ Removed ${file}`);
    removedCount++;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️  ${file} not found (already clean)`);
    } else {
      console.log(`⚠️  Could not remove ${file}: ${error.message}`);
    }
  }
}

console.log('==================');
if (removedCount > 0) {
  console.log(`🎉 Logout complete! Removed ${removedCount} file(s).`);
} else {
  console.log('✨ Already logged out (no files to remove).');
}
console.log('🔄 Next MCP request will trigger fresh login.');
