# Cursor Example: Setup to First Query

This guide walks you from setup to your first eGain MCP query using **Cursor IDE**, `npx`, and the browser-based PKCE authentication flow.

**Prerequisites:** Node.js 20+, eGain 21.22+, AI Services enabled, appropriate user access, and some Knowledge content.

> **Important:** Authentication uses a browser-based PKCE flow. A browser window will open on first use.
> - **PKCE-compatible client apps (SPAs) are required**
> - **Safari is not supported** — use Chrome, Edge, or Brave  
> See the [Authentication Guide](./authentication.md) for details.

## Step 1: Configure Cursor

1. In Cursor, select the Settings icon → `Tools & MCP` → `New MCP Server` to open the configuration file.
2. Add this configuration (replace `...` with your API domain):

Add the following configuration:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "npx",
      "args": ["@egain/egain-mcp-server", "start", "--api-domain", "..."]
    }
  }
}
```
## Step 2: Find your API domain

Go to your Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` (see "API Domain"). No access? Contact your eGain PA.

Replace `...` in the configuration with this value. 

That's it! The MCP server will be automatically downloaded and run when needed. No cloning or building required.

## Step 3: Run your first Claude query

Open a chat and try:
- "List the portals I can access." → uses `getPortals`.
- "Show popular articles for the Master portal." → uses `getPopularArticles` with `portalID`.
- "Create a suggestion for more articles in the Master portal." → uses `makeSuggestion` with `portalID`.

On your first MCP request, a supported browser opens a window for configuration and sign-in.

For more background on MCP and workflows, see the eGain MCP guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

