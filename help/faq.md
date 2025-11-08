# FAQ & Troubleshooting
## FAQ
**Q: My request fails before it even sends anything. Why?**  
A: AI agents sometimes deviate from MCP tool schemas (rename fields, skip required ones, change types). The MCP then rejects the call before it reaches the eGain API. Check logs for an MCP schema validation error (often shows which fields like `Dollar_lang` or `content` are missing/invalid). Use `--log-level debug` for more detail. Then prompt the AI agent which fields are missing/invalid and ask it to call the tool again with those fixes.

**Q: I can't find my API Domain or Scope Prefix. Where is it?**  
A: Certain applications may be configured differently. For more details and specifics, visit our [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

**Q: All these tools are asking for some portal ID. How do I discover my `portalID`?**  
A: Call `getPortals` first; it lists portals accessible to your user.

**Q: Cursor keeps making code suggestions instead of running the tools. What do I do?**  
A: DO NOT accept code edits. Use a separate window for the chat so it can’t see or modify your repo. If you accept edits and it breaks, we can’t support fixing it as you’ve modified the product.

**Q: Where is the access token stored?**  
A: At the repository root in `.bearer_token` with metadata in `.bearer_token_metadata` (created by the PKCE login flow or `node ./scripts/login.js`).

**Q: What happens when my token expires?**  
A: With PKCE, you’ll be prompted to sign in again automatically on the next request. If you use a direct access token, generate a new token and update your config.

**Q: How do I force a fresh login or clear token/cache?**  
A: Run `node ./scripts/logout.js`. It removes `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json`. To log in again, make any MCP request or run `node ./scripts/login.js`.

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

**No auth popup appears:**
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Verify your client application configuration is correct
- Check that your client app is configured as a PKCE-friendly SPA platform type (recommended)
- Try running `node ./scripts/login.js` manually to test authentication

**401/403 errors:**
- Verify token validity: run `node ./scripts/logout.js` then retry
- Check that your client app has the required API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`
- Confirm Authorization URL and Access Token URL policy names match your tenant configuration
- For commercial environments, verify Scope Prefix is set correctly (use Metadata value or `api.egain.cloud/auth/` if not present)
- Make sure your portal has the permissions such as AI Services are turned on, knowledge has been index, and/or allow suggestions.

**"invalid_client" error:**
- Verify Client ID is correct and matches your client application
- Ensure the client app exists and is enabled in your tenant
- **PKCE-friendly client apps (SPAs) are strongly preferred** - Make sure the client app is configured as a SPA platform type for public client
- Make sure Web confidential clients have their client secret (confidential clients are not recommended for PKCE flow)

**"redirect_uri" mismatch:**
- Ensure the Redirect URL you enter in the browser configuration form exactly matches the redirect URI configured in your client application (including trailing slashes, protocols)
- The redirect URL must match exactly - check for typos, trailing slashes, and protocol (http vs https)

**Public/Confidential client errors:**
- If you see "public client" errors: Don't enter Client Secret in the browser configuration form for public PKCE apps (SPAs)
- If you see "no client_secret available": Add Client Secret in the configuration form for confidential clients, or configure your app as a public SPA (recommended)

**Token expired or invalid:**
- With PKCE: You'll be prompted to sign in again automatically on the next request
- With direct token: Generate a new token and update your config with `--access-token`
- Force fresh login: Run `node ./scripts/logout.js` then retry

### Configuration Issues

**Browser configuration form not appearing:**
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- Try manually running `node ./scripts/login.js` to test

**Configuration not saving:**
- Check that you have write permissions to `~/.egain-mcp/config.json`
- Verify all required fields are filled in the configuration form
- Ensure URLs don't contain spaces (common mistake: pasting multiple URLs)

**MCP server not connecting:**
- Verify the absolute path in your MCP configuration points to the correct location of `mcp-server.js`
- On Windows: Use forward slashes (`/`) in paths even on Windows for MCP configuration
- Check that `node` is in your PATH and accessible
- Fully restart your MCP client (Claude Desktop, Cursor, etc.) after configuration changes—closing the window is not enough, you must quit and relaunch the application
- For Cursor: Verify configuration at `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\User\mcp.json` on Windows) and toggle the server on/off
- For Claude Desktop: Verify configuration in `claude_desktop_config.json`

**Missing API Domain or Scope Prefix:**
- Find API Domain: Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` → "API Domain"
- Find Scope Prefix: Same Metadata section → "API Permission Prefix"
- For commercial environments without Scope Prefix in Metadata, use `api.egain.cloud/auth/`
- Not required for Rigel environments

### MCP Tool Issues

**Request fails before sending (schema validation errors):**
- Check logs for MCP schema validation errors (often shows missing/invalid fields like `Dollar_lang` or `content`)
- Use `--log-level debug` for more detailed error information
- Prompt the AI agent about which fields are missing/invalid and ask it to call the tool again with fixes
- Verify the tool is being called with all required parameters

**Empty results from search/retrieve/answers:**
- Confirm AI Services are enabled and provisioned for your tenant
- Verify content has been indexed (may take time after enabling AI Services)
- Check that you have at least one accessible portal with content
- Ensure your user has appropriate permissions to access the portal

**Empty results from portal/article tools:**
- Verify Knowledge Portal Manager is set up with at least one portal
- Confirm your user has access to the portal (check portal permissions)
- Try listing portals first with `getPortals` to discover accessible `portalID` values

### Service & API Issues

**Rate limits or throttling:**
- Add retries/backoff in your client implementation
- Narrow your queries to be more specific
- Reduce request frequency if making many sequential calls

**Browser didn't open for authentication:**
- Ensure a supported browser (Chrome, Firefox, Edge, or Brave) is installed and accessible
- **Safari is not supported** - Please use Chrome, Firefox, Edge, or Brave
- Check system permissions for opening browser windows
- Verify network/VPN/proxy settings allow browser access
- Try manually running `node ./scripts/login.js` to test

**Safari browser issues:**
- **Safari is not supported** for authentication due to limited private browsing support via command line, which is required for secure OAuth flows
- Please install and use Chrome, Firefox, Edge, or Brave browser instead
- The MCP will detect Safari and show a warning page with installation instructions

**Still stuck after trying troubleshooting steps:**
- Clear all cached files: `node ./scripts/logout.js`
- Verify all configuration values against your Admin Console settings
- Ensure you're using a supported browser (Chrome, Firefox, Edge, or Brave - Safari is not supported)
- Verify your client app is configured as a PKCE-friendly SPA platform type (recommended)
- Check the [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) for detailed setup instructions
- Contact your eGain PA if you don't have access to required Admin Console settings

**Need additional help?**
- Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
- MCP Support: eloh@egain.com
- eGain Support: [Support Portal](https://support.egain.com)
