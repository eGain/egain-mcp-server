# Authentication Deep Dive

The eGain MCP uses a **browser-based PKCE OAuth flow**. Authentication requires a client application configured in your eGain tenant. Some environments may have a pre-configured client app named **APIs Trial** that you can use.

> Required delegated permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## Browser-Based PKCE Authentication (Recommended)

**Requirements**
- **Client application** configured in your eGain tenant (SPA platform recommended)
- **Supported browser:** Chrome, Edge, or Brave (**Safari is not supported**)
- User-actor PKCE flow (ensures actions run as the authenticated user)

> **Need to create a client application?** See the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) for step-by-step instructions. **Important:** When creating a client application, select **SPA** (Single Page Application) as the platform type for PKCE support.

### How It Works

https://github.com/user-attachments/assets/8df17bfa-141c-4f00-9412-5d3f6131574f

On your first MCP request (or when a token expires), a browser window opens with a configuration form. You’ll enter:

- **eGain Environment URL**
- **Client ID**
- **Authorization URL**
- **Access Token URL**
- **Redirect URL** (must exactly match your client app)
- **Scope Prefix** (if required by your environment)

To find your tenant-specific values, use the eGain Administrator Console:

1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open the client application of choice (if available, you may see **APIs Trial** which is pre-configured for MCP use). Note these values:
   - **Client ID** - Copy this value
   - **Redirect URL** - Must exactly match what you enter in the config form
3. Exit to the Client Application menu and click `Metadata`. Note these values:
   - **Auth URL** - OAuth2 authorization endpoint
   - **Access Token URL** - OAuth2 token endpoint
   - **API Permission Prefix** - Use as Scope Prefix (if present in Metadata)
   - **API Domain** - Used for the `--api-domain` flag in MCP configuration

Your configuration is stored locally in `~/.egain-mcp/config.json`. This configuration persists across sessions, so you only need to enter it once.

> **Need to create a client application?** See the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) for detailed instructions on setting up a client application in your eGain tenant. **Important:** When creating a client application, select **SPA** (Single Page Application) as the platform type for PKCE support.

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