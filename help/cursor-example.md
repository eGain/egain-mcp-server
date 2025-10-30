# Cursor Example: Setup to First Query

This is a precise, click-by-click guide starting immediately *after* you clone the repo. It uses stdio and the PKCE login flow. Download Cursor IDE to run this example.

*Prerequisites:* eGain 21.22+, appropriate user access, AI Services enabled, and some KB content.

**Step 1:** Set up `.env` — see the [Env Guide](./env-guide.md).

**Step 2:** Run `npm` commands to install and build the MCP.   
```bash
npm install
npm run build
```

**Step 3:** Configure Cursor for local  
Open Cursor → `Settings` (⌘, on Mac or Ctrl+, on Windows/Linux) → `Tools & MCP` → `New MCP Server`. Use this JSON as a reference for the configuration:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "/Users/eloh/egain-mcp/bin/mcp-server.js", // Replace with absolute path to your project
        "start",
        "--api-domain",
        "api.aidev.egain.cloud" // Replace with your API domain
      ]
    }
  }
}
```

Alternatively, you can manually edit the MCP configuration file at `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\User\mcp.json` on Windows) with the same JSON structure.

To find your API domain, go to your Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` (see "API Domain"). No access? Contact your eGain PA.

Note: `--api-domain` is the eGain API host. If omitted, the default is `api.aidev.egain.cloud`.

**Step 4:** Your first Cursor query
Restart Cursor to process the configuration. Open a new chat and try:
- "List the portals I can access." → uses `getPortals`.
- "Show popular articles for the Master portal." → uses `getPopularArticles` with `portalID`.
- "Create a suggestion for more articles in the Master portal." → uses `makeSuggestion` with `portalID`.

On your first MCP request, Chrome opens an incognito window for sign-in.

Tip: Start with "List the portals I can access" to discover valid `portalID` and portal names.

For more background on MCP and workflows, see the eGain MCP guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

