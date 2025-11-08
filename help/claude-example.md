# Claude Example: Setup to First Query

This is a precise, click-by-click guide starting immediately *after* you clone the repo. It uses stdio and the PKCE login flow. Download the Claude Desktop to run this example

*Prerequisites:* eGain 21.22+, appropriate user access, AI Services enabled, and some KB content.

**Step 1:** Run `npm` commands to install and build the MCP.
```bash
npm install
npm run build
```

**Important:** Authentication uses a browser-based configuration flow. When you first use the MCP, a browser window will open for configuration. **PKCE-friendly client apps (SPAs) are strongly preferred**, and **Safari browser is not supported** - use Chrome, Firefox, Edge, or Brave. For detailed setup instructions, see the [Authentication Guide](./authentication.md).

**Step 2:** Configure Claude Desktop for local  

1. Open Claude Desktop application
2. Click `Settings` (gear icon) in the bottom left, or go to `File` → `Settings` in the menu bar
3. Click `Developer` in the left sidebar
4. Click `Edit Config` button - this will open `claude_desktop_config.json` in your default text editor

**Note:** The config file location is typically:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json` (typically `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`)

Use this JSON as a reference for the configuration. Replace `./bin/mcp-server.js` with the absolute path to your project's `bin/mcp-server.js` file, and replace `api.aidev.egain.cloud` with your API domain from the Admin Console.

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "api.aidev.egain.cloud"
      ]
    }
  }
}
```

To find your API domain, go to your Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` (see "API Domain"). No access? Contact your eGain PA.

Note: `--api-domain` is the eGain API host. If omitted, the default is `api.aidev.egain.cloud`.

**Step 4:** Your first Claude query
Restart Claude to process the configuration. Open a new chat and try:
- "List the portals I can access." → uses `getPortals`.
- "Show popular articles for the Master portal." → uses `getPopularArticles` with `portalID`.
- "Create a suggestion for more articles in the Master portal." → uses `makeSuggestion` with `portalID`.

On your first MCP request, a supported browser (Chrome, Firefox, Edge, or Brave - Safari is not supported) opens a window for configuration and sign-in.

Tip: Start with "List the portals I can access" to discover valid `portalID` and portal names.

Watch a quick [demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385) to see MCP on Claude in action.

For more background on MCP and workflows, see the eGain MCP guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).
