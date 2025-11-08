# eGain MCP
<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>
<br />

> ⚠️ This MCP hosts eGain v4 APIs. Please do not attempt tool usage with previous API versions' standards. For more details about the v4 APIs, visit our [developer portal](https://apidev.egain.com/).

## Overview

This server implements MCP for eGain Knowledge, unifying Portal Manager, Search, Retrieve, and Answers into a single endpoint your AI client can call. Use it from Claude Desktop, Cursor, and others to browse portals, read articles, search/retrieve content, submit suggestions, and get AI‑powered answers with your existing portal permissions.
<!-- No Summary [summary] -->

Learn more about the tools and usage of the MCP in the [eGain MCP guide](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

<!-- No Table of Contents [toc] -->

### Prerequisites  
- eGain platform version 21.22 or newer.
- Access mirrors the user's permissions: MCP only sees content that user can see (portal/article visibility).
- AI Services must be enabled for your tenant and the target portal, or AI tools will not run.
- Knowledge content! I recommend at least 2 portals and 5 articles to give the MCP a try!
- A supported browser (Chrome, Firefox, Edge, or Brave) - **Safari is not supported**.
- A PKCE-friendly client application (SPA platform type recommended) configured in your eGain tenant.

## Local Configuration
### Step 1: Clone repository and install dependencies
> ⚠️ Do not modify the repository after cloning. The MCP works as intended

Clone this repository and install dependencies in the folder:

```bash
npm install
npm run build
```

### Step 2: Configuring with MCP Clients  
Firstly, to find your API domain, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Click `Metadata`. The value `API Domain` is detailed in the window.  

Please contact your eGain PA if you do not have access to these admin-only details.

To use this local version with **Cursor**, **Claude**, **Windsurf**, **VSC** or other MCP Clients, you'll need to add the following config:

**Note:** Replace `./bin/mcp-server.js` with the absolute path to your project's `bin/mcp-server.js` file, and replace `"..."` with your API domain from the Admin Console.

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "..."
      ]
    }
  }
}
```

If you're having trouble configuring your MCP client, see these detailed guides:
- Claude quick-start and example queries: [Claude Guide](./help/claude-example.md)
- Cursor quick-start and example queries: [Cursor Guide](./help/cursor-example.md)

### Step 3: Authenticate on first query

See it in action: Watch a quick [Claude demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385)

Once you've set up the server on your client, **run your first eGain MCP query** to authenticate. When you make your first MCP request, a browser window will automatically open for authentication.

**Important:**
- **PKCE-friendly client apps (SPAs) are strongly preferred** for the best authentication experience. Ensure your client app is configured as a Single Page Application (SPA) platform type in the eGain Administrator Console.
- **Safari browser is not supported** for authentication for security reasons. Please use Chrome, Firefox, Edge, or another supported browser.
- Ensure your client app has these delegated API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

You'll need to enter your authentication configuration values in the browser form. For detailed setup instructions and where to find these values, see the [Configuration Guide](./help/env-guide.md) and [Authentication Deep Dive](./help/authentication.md). Please contact your eGain PA if you do not have access to client application settings.

<!-- No Installation [installation] -->

## Debugging

Run the server manually for standalone debugging if you want to see raw logs, pass extra flags (e.g., `--log-level debug`), or reproduce issues in isolation:

```bash
node ./bin/mcp-server.js start --api-domain "..."
```

Alternatively, launch with the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --api-domain "..."
```

**Note:** Avoid running the server manually while also using it with an MCP client.

## Resources & Support
### Help Guides
- [What is MCP?](./help/what-is-mcp.md)
- [Authentication Deep Dive](./help/authentication.md)
- [Claude Example](./help/claude-example.md)
- [Cursor Example](./help/cursor-example.md)
- [BYO MCP Client LLM](./help/byo_llm_demo.ipynb)
- [FAQ & Troubleshooting](./help/faq.md)  
  
MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)

> ⚠️ Disclaimer: This MCP server is an early preview and is not production‑ready. It is provided as a “taste test” so you can explore the direction while we continue complete features. Expect limited functionality and frequent changes.

### Contact
* Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
* MCP Support: eloh@egain.com
* eGain Support: [Support Portal](https://support.egain.com)