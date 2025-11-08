# Authentication Deep Dive

The eGain MCP uses **PKCE Authentication Flow** with a browser-based configuration interface. Authentication requires a client app configured in your eGain tenant. If you do not already have a client app set up, please follow the [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

> Ensure your client app has these delegated API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## Browser-Based PKCE Authentication Flow (Recommended)

**Important Requirements:**
- **PKCE-friendly client apps (SPAs) are strongly preferred** - Configure your client app as a Single Page Application (SPA) platform type in the eGain Administrator Console for the best experience.
- **Safari browser is not supported** - Safari has limited private browsing support via command line, which is required for secure OAuth flows. Please use Chrome, Firefox, Edge, or Brave browser for authentication.
- Use user actor protected PKCE flow to only allow users to perform actions through the MCP.

### How It Works

When you first use the MCP or when your token expires during a query, a browser window will automatically open with a configuration form. You'll need to enter:

1. **eGain Environment URL** - Your base eGain instance URL
   - For Self Service, include the tenant path (e.g., `https://aidev.egain.cloud/a1b2`)
2. **Client ID** - From your client application
3. **Authorization URL** - OAuth2 authorization endpoint
4. **Access Token URL** - OAuth2 token endpoint
5. **Redirect URL** - Must exactly match the redirect URI configured in your client application
6. **Scope Prefix** (optional) - Not required for Rigel environments. For commercial environments, use the value from Metadata (API Permission Prefix), or `api.egain.cloud/auth/` if not present.
7. **Client Secret** (optional) - Not needed for public clients (PKCE/SPA). Only required for confidential clients.

### Finding Your Configuration Values

To find your tenant-specific values, use the eGain Administrator Console:

1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application of choice. Note these values:
   - **Client ID** - Copy this value
   - **Secrets** - Only if using confidential client (not recommended for PKCE)
   - **Redirect URL** - Must exactly match what you enter in the config form
3. Exit to the Client Application menu and click `Metadata`. Note these values:
   - **Auth URL** - OAuth2 authorization endpoint
   - **Access Token URL** - OAuth2 token endpoint
   - **API Permission Prefix** - Use as Scope Prefix for commercial environments
   - **API Domain** - Used for the `--api-domain` flag in MCP configuration

Reference: [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

### Configuration Storage

Your configuration is securely stored in `~/.egain-mcp/config.json` (user-only read/write permissions). This configuration persists across sessions, so you only need to enter it once.

### Authentication Flow

**Want to log in right away? Or test this login/logout flow?**  
1) Start your MCP client to make a query or run the login helper:
```bash
# Launch a manual login anytime
node ./scripts/login.js
```
2) Complete the browser configuration form and authentication. The token is saved to `.bearer_token` with metadata in `.bearer_token_metadata` at the repository root.

3) If you do not want to wait until a token expires to login again, manually clear saved token files with:
```bash
node ./scripts/logout.js
```
This removes: `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json`.

**Notes:** 
- Tokens auto‑reuse until near expiry; you'll be prompted to sign in again when making your next request.
- You can clear tokens anytime using the logout script.
- If you have saved configuration, you can sign in again without re-entering all values.

## Direct Access Token (Alternative)

Prefer a one‑time token or bypass the browser popup? Pass a bearer token via `--access-token`. To generate this token, see **Step 3** of [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

Configure your client (Cursor, Claude, etc.) like this:

**Note:** Replace `./bin/mcp-server.js` with the absolute path to your project's `bin/mcp-server.js` file, replace `api.egain.cloud` with your API domain from the Admin Console, and replace `YOUR_ACCESS_TOKEN` with your actual access token.

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "api.egain.cloud",
        "--access-token",
        "YOUR_ACCESS_TOKEN"
      ]
    }
  }
}
```

> ⚠️ **IMPORTANT:** Direct access tokens expire and need to be regenerated. The browser-based PKCE flow is recommended for automatic token refresh.