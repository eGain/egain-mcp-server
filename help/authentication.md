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

Authentication tokens are cached locally and reused until they expire. Tokens are stored in the npx cache directory: `~/.npm/_npx/[hash]/node_modules/@egain/egain-mcp-server/`

To reset authentication, delete the cached token files **only from the eGain MCP directory**:

**macOS / Linux / WSL / Git Bash**
```bash
# Find eGain MCP token files (only in npx cache)
find ~/.npm/_npx -path "*/@egain/egain-mcp-server/.bearer_token*" -delete 2>/dev/null
```

**Windows (PowerShell)**
```powershell
# Find eGain MCP token files (only in npx cache)
Get-ChildItem -Path "$env:USERPROFILE\.npm\_npx" -Recurse -Filter ".bearer_token*" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*@egain\egain-mcp-server*" } | Remove-Item -Force
```

**Safety note:** These commands only delete token files from the eGain MCP package directory in the npx cache, not from other locations on your system. If you want to verify which files will be deleted first, remove the `-delete` flag (macOS/Linux) or `Remove-Item` (Windows) to see the file paths.

You'll be prompted to sign in again on your next MCP request.


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