# FAQ & Troubleshooting

## Quick Troubleshooting

**Common issues and quick links:**

- **Browser didn't open / No auth popup** → [Authentication Issues](#authentication-issues)
- **401/403 errors** → [401/403 errors](#401403-errors)
- **"invalid_client" error** → ["invalid_client" error](#invalid_client-error)
- **"redirect_uri" mismatch** → ["redirect_uri" mismatch](#redirect_uri-mismatch)
- **Can't find MCP config file** → [MCP Config File Location](#mcp-config-file-location)
- **MCP server not connecting** → [MCP Server Not Connecting](#mcp-server-not-connecting)
- **Can't find API Domain** → [Finding API Domain](#finding-api-domain-or-scope-prefix)
- **Request fails before sending** → [Schema Validation Errors](#request-fails-before-sending-schema-validation-errors)
- **Empty results** → [Empty Results](#empty-results)

---

## FAQ

### Setup & Configuration

**Q: I can't find the MCP config file for Claude Desktop or Cursor. Where is it?**  
**A:** 

**Claude Desktop:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- Access: `Settings` → `Developer` → `Edit Config`

**Cursor:**
- **macOS/Linux:** `~/.cursor/mcp.json`
- **Windows:** `%APPDATA%\Cursor\User\mcp.json`
- Access: `Settings` → `Tools & MCP` → `New MCP Server`

See [Claude Guide](./claude-example.md) or [Cursor Guide](./cursor-example.md) for configuration format.

**Q: I can't find my API Domain or Scope Prefix. Where is it?**  
**A:** Find it in Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata`. For details, see the [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

**Q: I already have Node version 20+ but it doesn't work. Why?**  
**A:** **Claude Desktop bundles an older version of Node**, and `npx` resolves `node` via PATH (not the absolute path you specify), so it picks up Claude Desktop's bundled Node version (which is typically too old - this package requires Node 20+). This is a [known issue with MCP servers on certain apps](https://github.com/modelcontextprotocol/servers/issues/64).

**Solution:** Install globally and use absolute paths (recommended approach):

1. **Install Node 20+ using nvm** (if you don't have it):
   ```bash
   nvm install 22.22.0  # Recommended: use LTS version like 22.22.0 or 20.18.0
   nvm use 22.22.0
   ```

2. **Install the package globally**:
   ```bash
   npm install -g @egain/egain-mcp-server
   ```

3. **Use absolute paths in your MCP config**:

   **macOS/Linux:**
   ```json
   {
     "mcpServers": {
       "EgainMcp": {
         "command": "/Users/<username>/.nvm/versions/node/v<version>/bin/node",
         "args": [
           "/Users/<username>/.nvm/versions/node/v<version>/lib/node_modules/@egain/egain-mcp-server/bin/mcp-server.js",
           "start",
           "--api-domain",
           "api.example.com"
         ]
       }
     }
   }
   ```
   
   Replace `<username>` with your username and `<version>` with your Node version (e.g., `v22.22.0`).

   **Windows:**
   ```json
   {
     "mcpServers": {
       "EgainMcp": {
         "command": "C:\\Users\\<username>\\.nvm\\versions\\node\\v<version>\\node.exe",
         "args": [
           "C:\\Users\\<username>\\.nvm\\versions\\node\\v<version>\\lib\\node_modules\\@egain\\egain-mcp-server\\bin\\mcp-server.js",
           "start",
           "--api-domain",
           "api.example.com"
         ]
       }
     }
   }
   ```
   
   Replace `<username>` with your username and `<version>` with your Node version (e.g., `v22.22.0`).

### Authentication & Tokens

**Q: Where is the access token stored?**  
**A:** 
- **Config:** `~/.egain-mcp/config.json` (in your home directory)
- **Tokens:** `~/.npm/_npx/[hash]/node_modules/@egain/egain-mcp-server/` (next to `package.json` in npx cache)

Tokens are created automatically during PKCE login on your first MCP request.

**Q: How do I find my token files?**  
**A:** Token files are stored in the eGain MCP package directory within the npx cache:
- **macOS/Linux:** `find ~/.npm/_npx -path "*/@egain/egain-mcp-server/.bearer_token*" 2>/dev/null`
- **Windows:** Search for `.bearer_token` files in `%USERPROFILE%\.npm\_npx\` subdirectories containing `@egain\egain-mcp-server`

**Safety note:** These commands only search within the eGain MCP package directory, not your entire system, to avoid finding token files from other applications.

**Q: What happens when my token expires?**  
**A:** With PKCE, you'll be prompted to sign in again automatically on the next request. **During the re-authentication flow, the configuration form will appear again**, allowing you to update your configuration values (environment URL, client ID, authorization URLs, etc.) if needed. With a direct access token, generate a new token and update your config.

**Q: How do I force a fresh login or clear token/cache?**  
**A:** Delete token files **only from the eGain MCP directory** in the npx cache:
- **macOS/Linux:** `find ~/.npm/_npx -path "*/@egain/egain-mcp-server/.bearer_token*" -delete 2>/dev/null`
- **Windows (PowerShell):** 
  ```powershell
  Get-ChildItem -Path "$env:USERPROFILE\.npm\_npx" -Recurse -Filter ".bearer_token*" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*@egain\egain-mcp-server*" } | Remove-Item -Force
  ```

**Safety note:** These commands only delete token files from the eGain MCP package directory (`@egain/egain-mcp-server`), not from other locations. To verify which files will be deleted first, remove the `-delete` flag (macOS/Linux) or `Remove-Item` (Windows) to see the file paths.

Then make any MCP request - authentication will happen automatically.

**Q: How do I reset my configuration (delete config.json)?**  
**A:** You have two options to update your configuration:

1. **Wait for token expiration** (easiest): When your token expires, you'll be prompted to sign in again, and the configuration form will appear automatically. You can update your configuration values (environment URL, client ID, authorization URLs, etc.) during this re-authentication flow.

2. **Manually delete config.json** (if you need to reset immediately): Delete the config file:
   - **macOS/Linux:** `rm ~/.egain-mcp/config.json`
   - **Windows (PowerShell):** `Remove-Item "$env:USERPROFILE\.egain-mcp\config.json"`
   
   **Note:** This will delete your saved configuration. You'll need to enter these values again on your next MCP request when the configuration form appears. This does NOT delete your authentication tokens - see [How do I force a fresh login](#q-how-do-i-force-a-fresh-login-or-clear-tokencache) above to clear tokens.

**Q: Does the PKCE authentication flow work on Windows?**  
**A:** Yes. PKCE works on macOS and Windows. You can also use a direct bearer token via `--access-token`. **Note:** Safari browser is not supported - use Chrome, Edge, or Brave instead.

**Q: Why multiple authentication steps? Can we allow anonymous use?**  
**A:** Authentication applies your organizational permissions and ensures secure, role-aware access. Anonymous access isn't supported.

### Using the Tools

**Q: All these tools are asking for some portal ID. How do I discover my `portalID`?**  
**A:** Call `getPortals` first; it lists portals accessible to your user.

**Q: Which tools are available?**  
**A:** `getPortals`, `getPopularArticles`, `getAnnouncements`, `getArticle`, `makeSuggestion`, `querySearch`, `queryRetrieve`, `queryAnswers`.

**Q: Do I need certain services enabled for this MCP to work?**  
**A:** Yes. AI Services must be provisioned and content indexed for search/retrieve/answers; Knowledge Portal Manager requires a KB and at least one accessible portal. Otherwise related tools return empty or errors.

**Q: Are there rate limits or quotas?**  
**A:** Yes. Add retries/backoff and narrow queries if you see throttling.

**Q: My request fails before it even sends anything. Why?**  
**A:** AI agents sometimes deviate from MCP tool schemas (rename fields, skip required ones, change types). The MCP rejects the call before it reaches the eGain API. Check logs for schema validation errors (often shows missing/invalid fields like `Dollar_lang` or `content`). Use `--log-level debug` for more detail, then prompt the AI agent to fix the fields and retry.

**Q: Cursor keeps making code suggestions instead of running the tools. What do I do?**  
**A:** DO NOT accept code edits. Use a separate window for the chat so it can't see or modify your repo. If you accept edits and it breaks, we can't support fixing it as you've modified the product.

---

## Troubleshooting

### Authentication Issues

**No auth popup appears**
- Ensure a supported browser (Chrome, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Edge, or Brave
- Verify your client application configuration is correct
- Check if your environment has a pre-configured **APIs Trial** client app available
- If you need to create a client application, see the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) — **be sure to select SPA (Single Page Application) as the platform type** (Web requires a client secret and is not PKCE-compatible)

**401/403 errors**
- Verify token validity: Find and delete `.bearer_token` files **only from the eGain MCP directory** in `~/.npm/_npx/` (see [Finding Token Files](#q-how-do-i-find-my-token-files) above) then retry
- Check that your client app has the required API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`
- Confirm Authorization URL and Access Token URL policy names match your tenant configuration
- Verify Scope Prefix is set correctly (use Metadata value if present)
- Ensure portal permissions: AI Services are turned on, knowledge has been indexed, and/or allow suggestions

**"invalid_client" error**
- Verify Client ID is correct and matches your client application
- Ensure the client app exists and is enabled in your tenant
- Check if your environment has a pre-configured **APIs Trial** client app available
- If you need to create a client application, see the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) — **be sure to select SPA (Single Page Application) as the platform type**

**"redirect_uri" mismatch**
- Ensure the Redirect URL you enter in the browser configuration form exactly matches the redirect URI configured in your client application (including trailing slashes, protocols)
- The redirect URL must match exactly - check for typos, trailing slashes, and protocol (http vs https)

**Token expired or invalid**
- With PKCE: You'll be prompted to sign in again automatically on the next request. **During re-authentication, the configuration form will appear**, allowing you to update your configuration values if needed
- With direct token: Generate a new token and update your config with `--access-token`
- Force fresh login: Find and delete `.bearer_token` files **only from the eGain MCP directory** in `~/.npm/_npx/` (see [Finding Token Files](#q-how-do-i-find-my-token-files) above) then retry

**Browser didn't open for authentication**
- Ensure a supported browser (Chrome, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- **If authentication UI hangs after redirect:** See [Authentication UI hangs after redirect](#authentication-ui-hangs-after-redirect-page-macos) below

**Safari browser issues**
- **Safari is not supported** for authentication due to limited private browsing support via command line, which is required for secure OAuth flows
- Please install and use Chrome, Edge, or Brave browser instead
- The MCP will detect Safari and show a warning page with installation instructions

**Authentication UI hangs after redirect page (macOS)**
If the authentication UI hangs or stalls after the redirect page (nothing happens past the redirect), and logs show `about:blank`, this is typically a macOS Automation permissions issue. Try these steps:

1. **Check macOS Automation permissions:**
   - Go to **System Settings** (or **System Preferences** on older macOS) → **Privacy & Security** → **Automation**
   - Find your MCP client application (Claude Desktop, Cursor, Terminal, etc.) in the list
   - Ensure that **Chrome** (or your browser) is checked/enabled for automation
   - If Chrome is not listed, trigger the authentication flow once to prompt macOS to ask for permission

2. **Restart applications:**
   - **Fully quit Chrome** (not just close windows - use Chrome menu → Quit Chrome, or Cmd+Q)
   - **Fully quit your MCP client** (Claude Desktop, Cursor, etc.) - closing the window is not enough, you must quit the application
   - Restart both Chrome and your MCP client
   - Try the authentication flow again

### Configuration Issues

**Browser configuration form not appearing**
- Ensure a supported browser (Chrome, Edge, or Brave) is installed
- **Safari is not supported** - Please use Chrome, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- Check if your environment has a pre-configured **APIs Trial** client app available
- Ensure you have a client application configured in your eGain tenant (see [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) if needed — **be sure to select SPA platform type**)

**Configuration not saving**
- Check that you have write permissions to `~/.egain-mcp/config.json`
- Verify all required fields are filled in the configuration form
- Ensure URLs don't contain spaces (common mistake: pasting multiple URLs)

**MCP server not connecting**
- **If you have Node 20+ but it still doesn't work:** This is likely because `npx` resolves to the wrong Node version. See the FAQ entry [above](#q-i-already-have-node-version-20-but-it-doesnt-work-why) - install globally and use absolute paths (recommended approach)
- On Windows: Use backslashes (`\\`) in paths for Windows MCP configuration
- Fully restart your MCP client (Claude Desktop, Cursor, etc.) after configuration changes—closing the window is not enough, you must quit and relaunch the application
- For Cursor: Verify configuration at `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\User\mcp.json` on Windows) and toggle the server on/off
- For Claude Desktop: Verify configuration in `claude_desktop_config.json`

**Error: "Cannot find module 'node:path'" when using npx** {#error-cannot-find-module-nodepath-when-using-npx}
If you see an error like `Error: Cannot find module 'node:path'` in npm's code (`npm/lib/cli.js`), this happens because `npx` uses `#!/usr/bin/env node` which resolves `node` via PATH, not the absolute path you specify. This is a [known issue with MCP servers and NVM](https://github.com/modelcontextprotocol/servers/issues/64).

**Solution:** Install globally and use absolute paths to `node` directly (see the FAQ entry above). This bypasses `npx` entirely and avoids PATH resolution issues.

If you still get errors after switching to global install:
- Reinstall npm: `npm install -g npm@latest`
- Or reinstall Node: `nvm uninstall v<version> && nvm install v<version>`
- Try a different Node LTS version (20.x or 22.x recommended)

**Missing API Domain or Scope Prefix**
- Find API Domain: Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` → "API Domain"
- Find Scope Prefix: Same Metadata section → "API Permission Prefix" (if present)
- If Scope Prefix is not present in Metadata, you may not need it for your environment

### MCP Tool Issues

**Request fails before sending (schema validation errors)**
- Check logs for MCP schema validation errors (often shows missing/invalid fields like `Dollar_lang` or `content`)
- Use `--log-level debug` for more detailed error information
- Prompt the AI agent about which fields are missing/invalid and ask it to call the tool again with fixes
- Verify the tool is being called with all required parameters

**Empty results from search/retrieve/answers**
- Confirm AI Services are enabled and provisioned for your tenant
- Verify content has been indexed (may take time after enabling AI Services)
- Check that you have at least one accessible portal with content
- Ensure your user has appropriate permissions to access the portal

**Empty results from portal/article tools**
- Verify Knowledge Portal Manager is set up with at least one portal
- Confirm your user has access to the portal (check portal permissions)
- Try listing portals first with `getPortals` to discover accessible `portalID` values

### Service & API Issues

**Rate limits or throttling**
- Add retries/backoff in your client implementation
- Narrow your queries to be more specific
- Reduce request frequency if making many sequential calls

---

## Still Stuck?

**Try these steps:**
- Clear all cached files: Find and delete `.bearer_token` and `.bearer_token_metadata` files **only from the eGain MCP directory** in `~/.npm/_npx/` (see [Finding Token Files](#q-how-do-i-find-my-token-files) above)
- Reset configuration: If you entered incorrect configuration values, delete `~/.egain-mcp/config.json` to start fresh (see [How do I reset my configuration](#q-how-do-i-reset-my-configuration-delete-configjson) above)
- Verify all configuration values against your Admin Console settings
- Ensure you're using a supported browser (Chrome, Edge, or Brave - Safari is not supported)
- Check if your environment has a pre-configured **APIs Trial** client app available
- Ensure you have a client application configured in your eGain tenant (see [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) if needed — **be sure to select SPA platform type, not Web**)
- Check the [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) for detailed setup instructions
- Contact your eGain PA if you don't have access to required Admin Console settings

**Need additional help?**
- Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
- MCP Support: eloh@egain.com
- eGain Support: [Support Portal](https://support.egain.com)
