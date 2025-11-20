# FAQ & Troubleshooting

## Quick Troubleshooting

**Common issues and quick links:**

- **Browser didn't open / No auth popup** → [No auth popup appears](#no-auth-popup-appears)
- **401/403 errors** → [401/403 errors](#401403-errors)
- **"invalid_client" error** → ["invalid_client" error](#invalid_client-error)
- **"redirect_uri" mismatch** → ["redirect_uri" mismatch](#redirect_uri-mismatch)
- **Can't find MCP config file** → [MCP config file location](#q-i-cant-find-the-mcp-config-file-for-claude-desktop-or-cursor-where-is-it)
- **MCP server not connecting** → [MCP server not connecting](#mcp-server-not-connecting)
- **Can't find API Domain** → [Finding API Domain](#q-i-cant-find-my-api-domain-or-scope-prefix-where-is-it)
- **Request fails before sending** → [Schema validation errors](#request-fails-before-sending-schema-validation-errors)
- **Empty results** → [Empty results](#empty-results-from-searchretrieveanswers)

---

## FAQ

**Q: My request fails before it even sends anything. Why?**  
A: AI agents sometimes deviate from MCP tool schemas (rename fields, skip required ones, change types). The MCP then rejects the call before it reaches the eGain API. Check logs for an MCP schema validation error (often shows which fields like `Dollar_lang` or `content` are missing/invalid). Use `--log-level debug` for more detail. Then prompt the AI agent which fields are missing/invalid and ask it to call the tool again with those fixes.

**Q: I can't find my API Domain or Scope Prefix. Where is it?**  
A: Certain applications may be configured differently. For more details and specifics, visit our [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

**Q: All these tools are asking for some portal ID. How do I discover my `portalID`?**  
A: Call `getPortals` first; it lists portals accessible to your user.

**Q: Cursor keeps making code suggestions instead of running the tools. What do I do?**  
A: DO NOT accept code edits. Use a separate window for the chat so it can't see or modify your repo. If you accept edits and it breaks, we can't support fixing it as you've modified the product.

**Q: I can't find the MCP config file for Claude Desktop or Cursor. Where is it?**  
A: The MCP configuration files are stored in specific locations depending on your application and operating system:

**Claude Desktop:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Full path example: `/Users/YourUsername/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
  - Full path example: `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`

To access it:
1. Open Claude Desktop
2. Click `Settings` (gear icon) → `Developer` → `Edit Config`
3. Or navigate to the file path above and open it in a text editor

**Cursor:**
- **macOS/Linux:** `~/.cursor/mcp.json`
  - Full path example: `/Users/YourUsername/.cursor/mcp.json`
- **Windows:** `%APPDATA%\Cursor\User\mcp.json`
  - Full path example: `C:\Users\YourUsername\AppData\Roaming\Cursor\User\mcp.json`

To access it:
1. In Cursor: `Settings` → `Tools & MCP` → `New MCP Server` (opens the config file)
2. Or navigate to the file path above and open it in a text editor

**Note:** If the file doesn't exist, create it with the appropriate JSON structure. See the [Claude Guide](./claude-example.md) or [Cursor Guide](./cursor-example.md) for the exact configuration format.

**Q: Where is the access token stored?**  
A: Configuration is stored in `~/.egain-mcp/config.json`. Tokens (`.bearer_token` and `.bearer_token_metadata`) are stored next to `package.json` in the project directory:
- **If you cloned the repository:** Tokens are in your cloned repo directory (same level as `package.json`)
- **If using npx:** Tokens are in the npx cache directory (`~/.npm/_npx/[hash]/node_modules/@egain/egain-mcp-server/`) where npx stores the package

Both methods work the same way - tokens are stored alongside `package.json`. The only difference is the location. These are created automatically by the PKCE login flow when you make your first MCP request.

**Q: Where is `~/.egain-mcp/` located on my system?**  
A: The `~` symbol represents your home directory. The exact path depends on your operating system:
- **macOS:** `/Users/YourUsername/.egain-mcp/` (e.g., `/Users/john/.egain-mcp/`)
- **Linux:** `/home/YourUsername/.egain-mcp/` (e.g., `/home/john/.egain-mcp/`)
- **Windows:** `C:\Users\YourUsername\.egain-mcp\` (e.g., `C:\Users\john\.egain-mcp\`)

To find it on your system:
- **macOS/Linux:** Open Terminal and run `echo ~/.egain-mcp`
- **Windows:** Open Command Prompt and run `echo %USERPROFILE%\.egain-mcp`

**Note:** `~/.egain-mcp/` only contains `config.json`. Tokens are stored separately.

**Q: How do I find my token files if I'm using npx?**  
A: When using npx, the project is stored in npx's cache directory, so tokens are there too. To find them:
- **macOS/Linux:** Run `find ~/.npm/_npx -name ".bearer_token*" 2>/dev/null`
- **Windows:** Search for `.bearer_token` files in `%USERPROFILE%\.npm\_npx\`

The files will be next to `package.json` in a subdirectory like `~/.npm/_npx/[hash]/node_modules/@egain/egain-mcp-server/`. This is the same as cloning - tokens are always stored next to `package.json`, just in a different location.

**Q: What happens when my token expires?**  
A: With PKCE, you’ll be prompted to sign in again automatically on the next request. If you use a direct access token, generate a new token and update your config.

**Q: How do I force a fresh login or clear token/cache?**  
A: 
- **If you cloned the repository:** Run `node ./scripts/logout.js`. It removes `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json` from the project root directory.
- **If using npx:** Find and delete the token files in the npx cache:
  - **macOS/Linux:** `find ~/.npm/_npx -name ".bearer_token*" -delete 2>/dev/null` (or find them first with `find ~/.npm/_npx -name ".bearer_token*" 2>/dev/null` then delete manually)
  - **Windows:** Navigate to `%USERPROFILE%\.npm\_npx\` and search for `.bearer_token` files to delete

To log in again, make any MCP request - authentication will happen automatically.

**Q: What is my `--api-domain`?**  
A: Find it in the Client Application Metadata in the eGain Admin Console. Pass it via `--api-domain`. See: [API authentication guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

**Q: Which tools are available?**  
A: `getPortals`, `getPopularArticles`, `getAnnouncements`, `getArticle`, `makeSuggestion`, `querySearch`, `queryRetrieve`, `queryAnswers`.

**Q: Do I need certain services enabled for this MCP to work?**  
A: Yes. AI Services must be provisioned and content indexed for search/retrieve/answers; Knowledge Portal Manager requires a KB and at least one accessible portal. Otherwise related tools return empty or errors.

**Q: Are there rate limits or quotas?**  
A: Yes. Add retries/backoff and narrow queries if you see throttling.

**Q: I'm having trouble authenticating during chat. What should I try?**  
A: Verify your client application configuration, test a manual login (`node ./scripts/login.js`), then try clearing cached files (`node ./scripts/logout.js`). Ensure you're using a supported browser (Chrome, Firefox, Edge, or Brave - Safari is not supported). If you failed to sign in the first time due to username or password mismatch, reattempt with a clean chat.

**Q: Why multiple authentication steps? Can we allow anonymous use?**  
A: Authentication applies your organizational permissions and ensures secure, role‑aware access. Anonymous access isn’t supported.

**Q: Does the PKCE authentication flow work on Windows?**  
A: Yes. PKCE works on both macOS and Windows. You can also use a direct bearer token via `--access-token`. **Note:** Safari browser is not supported - use Chrome, Firefox, Edge, or Brave instead.

---

## Troubleshooting

### Authentication Issues

#### No auth popup appears
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Verify your client application configuration is correct
- Check that your client app is configured as a PKCE-friendly SPA platform type (recommended)
- If you cloned the repository, try running `node ./scripts/login.js` manually to test authentication

#### 401/403 errors
- Verify token validity: If you cloned the repo, run `node ./scripts/logout.js` then retry. If using npx, find and delete `.bearer_token` files in `~/.npm/_npx/` (see FAQ above) then retry.
- Check that your client app has the required API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`
- Confirm Authorization URL and Access Token URL policy names match your tenant configuration
- For commercial environments, verify Scope Prefix is set correctly (use Metadata value or `api.egain.cloud/auth/` if not present)
- Make sure your portal has the permissions such as AI Services are turned on, knowledge has been index, and/or allow suggestions.

#### "invalid_client" error
- Verify Client ID is correct and matches your client application
- Ensure the client app exists and is enabled in your tenant
- **PKCE-friendly client apps (SPAs) are strongly preferred** - Make sure the client app is configured as a SPA platform type for public client
- Make sure Web confidential clients have their client secret (confidential clients are not recommended for PKCE flow)

#### "redirect_uri" mismatch
- Ensure the Redirect URL you enter in the browser configuration form exactly matches the redirect URI configured in your client application (including trailing slashes, protocols)
- The redirect URL must match exactly - check for typos, trailing slashes, and protocol (http vs https)

#### Public/Confidential client errors
- If you see "public client" errors: Don't enter Client Secret in the browser configuration form for public PKCE apps (SPAs)
- If you see "no client_secret available": Add Client Secret in the configuration form for confidential clients, or configure your app as a public SPA (recommended)

#### Token expired or invalid
- With PKCE: You'll be prompted to sign in again automatically on the next request
- With direct token: Generate a new token and update your config with `--access-token`
- Force fresh login: If you cloned the repo, run `node ./scripts/logout.js` then retry. If using npx, find and delete `.bearer_token` files in `~/.npm/_npx/` (see FAQ above) then retry.

### Configuration Issues

#### Browser configuration form not appearing
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- If you cloned the repository, try manually running `node ./scripts/login.js` to test

#### Configuration not saving
- Check that you have write permissions to `~/.egain-mcp/config.json`
- Verify all required fields are filled in the configuration form
- Ensure URLs don't contain spaces (common mistake: pasting multiple URLs)

#### MCP server not connecting
- If using npx: Ensure `npx` is available (comes with npm/Node.js)
- If using cloned repo: Verify the absolute path in your MCP configuration points to the correct location of `mcp-server.js`
- On Windows: Use forward slashes (`/`) in paths even on Windows for MCP configuration
- Check that `node` is in your PATH and accessible
- Fully restart your MCP client (Claude Desktop, Cursor, etc.) after configuration changes—closing the window is not enough, you must quit and relaunch the application
- For Cursor: Verify configuration at `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\User\mcp.json` on Windows) and toggle the server on/off
- For Claude Desktop: Verify configuration in `claude_desktop_config.json`

#### Missing API Domain or Scope Prefix
- Find API Domain: Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` → "API Domain"
- Find Scope Prefix: Same Metadata section → "API Permission Prefix"
- For commercial environments without Scope Prefix in Metadata, use `api.egain.cloud/auth/`
- Not required for Rigel environments

### MCP Tool Issues

#### Request fails before sending (schema validation errors)
- Check logs for MCP schema validation errors (often shows missing/invalid fields like `Dollar_lang` or `content`)
- Use `--log-level debug` for more detailed error information
- Prompt the AI agent about which fields are missing/invalid and ask it to call the tool again with fixes
- Verify the tool is being called with all required parameters

#### Empty results from search/retrieve/answers
- Confirm AI Services are enabled and provisioned for your tenant
- Verify content has been indexed (may take time after enabling AI Services)
- Check that you have at least one accessible portal with content
- Ensure your user has appropriate permissions to access the portal

#### Empty results from portal/article tools
- Verify Knowledge Portal Manager is set up with at least one portal
- Confirm your user has access to the portal (check portal permissions)
- Try listing portals first with `getPortals` to discover accessible `portalID` values

### Service & API Issues

#### Rate limits or throttling
- Add retries/backoff in your client implementation
- Narrow your queries to be more specific
- Reduce request frequency if making many sequential calls

#### Browser didn't open for authentication
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- If you cloned the repository, try manually running `node ./scripts/login.js` to test

#### Safari browser issues
- **Safari is not supported** for authentication due to limited private browsing support via command line, which is required for secure OAuth flows
- Please install and use Chrome, Firefox, Edge, or Brave browser instead
- The MCP will detect Safari and show a warning page with installation instructions

**Still stuck after trying troubleshooting steps:**
- Clear all cached files: If you cloned the repo, run `node ./scripts/logout.js`. If using npx, find and delete `.bearer_token` and `.bearer_token_metadata` files in `~/.npm/_npx/` (see FAQ above). Note: `~/.egain-mcp/` only contains `config.json` - deleting it will remove your saved configuration.
- Verify all configuration values against your Admin Console settings
- Ensure you're using a supported browser (Chrome, Firefox, Edge, or Brave - Safari is not supported)
- Verify your client app is configured as a PKCE-friendly SPA platform type (recommended)
- Check the [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) for detailed setup instructions
- Contact your eGain PA if you don't have access to required Admin Console settings

**Need additional help?**
- Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
- MCP Support: eloh@egain.com
- eGain Support: [Support Portal](https://support.egain.com)

---

