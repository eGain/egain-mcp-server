# Cursor Example: Setup to First Query

This is a precise, click-by-click guide starting immediately *after* you clone the repo. It uses stdio and the PKCE login flow. Download Cursor IDE to run this example.

*Prerequisites:* eGain 21.22+, appropriate user access, AI Services enabled, and some KB content.

> ⚠️ Do not modify the repository after cloning. The MCP works as intended

**Step 1:** Run `npm` commands to install and build the MCP.

**Important:** Authentication uses a browser-based configuration flow. When you first use the MCP, a browser window will open for configuration. **PKCE-friendly client apps (SPAs) are strongly preferred**, and **Safari browser is not supported** - use Chrome, Firefox, Edge, or Brave. For detailed setup instructions, see the [Authentication Guide](./authentication.md).   
```bash
npm install
npm run build
```

**Step 2:** Configure Cursor for local  

**Option A: Using Cursor's UI**
1. In Cursor, select the Settings icon → `Tools & MCP` → `New MCP Server` to open the configuration file.
2. Use this JSON as a reference for the configuration file:

**Note:** Replace `/Users/eloh/egain-mcp/bin/mcp-server.js` with the absolute path to your project's `bin/mcp-server.js` file, and replace `api.aidev.egain.cloud` with your API domain from the Admin Console.

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "/Users/eloh/egain-mcp/bin/mcp-server.js",
        "start",
        "--api-domain",
        "api.aidev.egain.cloud"
      ]
    }
  }
}
```

**Option B: Manual file editing**
Alternatively, you can manually edit the MCP configuration file directly:
- **macOS/Linux:** `~/.cursor/mcp.json` (in your home directory)
- **Windows:** `%APPDATA%\Cursor\User\mcp.json` (typically `C:\Users\YourUsername\AppData\Roaming\Cursor\User\mcp.json`)

Create this file if it doesn't exist, then add the same JSON structure shown above.

To find your API domain, go to your Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` (see "API Domain"). No access? Contact your eGain PA.

Note: `--api-domain` is the eGain API host. If omitted, the default is `api.aidev.egain.cloud`.

**Step 3:** Your first Cursor query
Restart Cursor to process the configuration. Open a new chat on an empty window and try:
- "List the portals I can access." → uses `getPortals`.
- "Show popular articles for the Master portal." → uses `getPopularArticles` with `portalID`.
- "Create a suggestion for more articles in the Master portal." → uses `makeSuggestion` with `portalID`.

On your first MCP request, a supported browser (Chrome, Firefox, Edge, or Brave - Safari is not supported) opens a window for configuration and sign-in.

Tip: Start with "List the portals I can access" to discover valid `portalID` and portal names.

For more background on MCP and workflows, see the eGain MCP guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

