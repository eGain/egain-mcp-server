# Claude Example: Setup to First Query

This guide walks you from setup to your first eGain MCP query using **Claude Desktop**, `npx`, and the browser-based PKCE authentication flow.

**Prerequisites:** Node.js 20+, eGain 21.22+, AI Services enabled, appropriate user access, and some Knowledge content.

> **Important:** Authentication uses a browser-based PKCE flow. A browser window will open on first use.
> - **Client application required** — you'll need a SPA client application configured in your eGain tenant (some environments may have a pre-configured **APIs Trial** client app)
> - **Safari is not supported** — use Chrome, Edge, or Brave  
> See the [Authentication Guide](./authentication.md) for details.

## Step 1: Configure Claude Desktop

1. Open **Claude Desktop** and go to **Settings** (gear icon or `File → Settings`)
2. Select **Developer** → **Edit Config** to open `claude_desktop_config.json`

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

Go to your Admin Console → `Partition` → `Integration` → `Client Application` → `Metadata` (see "API Domain"). If you see **APIs Trial** in your client applications list, you can use that. No access? Contact your eGain PA.

Replace `...` in the configuration with this value.  

## Step 3: Run your first Claude query

Restart Claude to load the configuration, then open a new chat and try:

- **“List the portals I can access”** → `getPortals`
- **“Show popular articles for the Master portal”** → `getPopularArticles`
- **“Create a suggestion for the Master portal”** → `makeSuggestion`

On your first MCP request, a supported browser will open for configuration and sign-in.

Watch a quick [Claude MCP demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385).

For more background, see the [eGain MCP Guide](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).