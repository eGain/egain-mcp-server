# Authentication Deep Dive

The eGain MCP uses a **browser-based PKCE OAuth flow**. Authentication requires a client application configured in your eGain tenant. If you don’t already have one, follow the [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

> Required delegated permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## Browser-Based PKCE Authentication (Recommended)

**Requirements**
- **PKCE-compatible client app** (SPA platform type strongly recommended)
- **Supported browser:** Chrome, Edge, or Brave (**Safari is not supported**)
- User-actor PKCE flow (ensures actions run as the authenticated user)

### How It Works

https://github.com/user-attachments/assets/8df17bfa-141c-4f00-9412-5d3f6131574f

On your first MCP request (or when a token expires), a browser window opens with a configuration form. You’ll enter:

- **eGain Environment URL**
- **Client ID**
- **Authorization URL**
- **Access Token URL**
- **Redirect URL** (must exactly match your client app)
- **Scope Prefix** (commercial tenants only)

To find your tenant-specific values, use the eGain Administrator Console:

1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application of choice. Note these values:
   - **Client ID** - Copy this value
   - **Redirect URL** - Must exactly match what you enter in the config form
3. Exit to the Client Application menu and click `Metadata`. Note these values:
   - **Auth URL** - OAuth2 authorization endpoint
   - **Access Token URL** - OAuth2 token endpoint
   - **API Permission Prefix** - Use as Scope Prefix for commercial environments
   - **API Domain** - Used for the `--api-domain` flag in MCP configuration

Reference: [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

Your configuration is stored locally in `~/.egain-mcp/config.json`. This configuration persists across sessions, so you only need to enter it once.

### Token Storage & Clearing

Authentication tokens are cached locally and reused until they expire.

To reset authentication, delete any cached token files:

**macOS / Linux / WSL / Git Bash**
```bash
find ~ -name ".bearer_token*" -exec rm {} \; 2>/dev/null
```
**Windows (PowerShell)**
```bash
Get-ChildItem -Path $env:USERPROFILE -Recurse -Filter ".bearer_token*" -ErrorAction SilentlyContinue | Remove-Item -Force
```

You’ll be prompted to sign in again on your next MCP request.


## Direct Access Token (Alternative)
> ⚠️ Direct access tokens **expire** and do not auto-refresh. PKCE is recommended.

Prefer a one‑time token or bypass the browser popup? Pass a bearer token via `--access-token`. To generate this token, see **Step 3** of [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/). Configure your client like this:
```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "npx",
      "args": [
        "@egain/egain-mcp-server",
        "start",
        "--api-domain",
        "...",
        "--access-token",
        "..."
      ]
    }
  }
}
```