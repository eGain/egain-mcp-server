# eGain MCP Server
Model Context Protocol (MCP) Server for the *egain-mcp-server*.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>
<br />


## Overview

This server implements MCP for eGain Knowledge, unifying Portal Manager, Search, Retrieve, and Answers into a single endpoint your AI client can call. Use it from Claude Desktop, Cursor, and others to browse portals, read articles, search/retrieve content, submit suggestions, and get AI‑powered answers with your existing portal permissions.

> ⚠️ This MCP hosts eGain v4 APIs. Please do not attempt tool usage with previous API versions' standards. For more details about the v4 APIs, visit our [developer portal](https://apidev.egain.com/).

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

## Installation

### Quick Start: Install with npx (Recommended)

The easiest way to get started is to install directly with `npx`. No cloning or building required!

**Step 1:** Find your API domain using the eGain Administrator Console:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Click `Metadata`. The value `API Domain` is detailed in the window.  

Please contact your eGain PA if you do not have access to these admin-only details.

**Step 2:** Configure your MCP client (Cursor, Claude Desktop, Windsurf, VS Code, etc.) with the following:

**Note:** Replace `"..."` with your API domain from the Admin Console.

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "npx",
      "args": [
        "@egain/egain-mcp-server",
        "start",
        "--api-domain",
        "..."
      ]
    }
  }
}
```

That's it! The MCP server will be automatically downloaded and run when needed.

### Advanced: Clone Repository (Not Recommended)

> ⚠️ **Important:** Cloning is **only for contributors** or very specific use cases. **Do not modify the code** - the MCP works as intended. Any modifications are **unsupported** and may cause failures. If you encounter issues after modifying the code, we cannot provide support.

```bash
git clone https://github.com/eGain/egain-mcp-server
cd egain-mcp-server
npm install
npm run build
```

Configure with absolute path to `bin/mcp-server.js`:
```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": ["./bin/mcp-server.js", "start", "--api-domain", "..."]
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

## 🆘 Having Issues?

**Check our troubleshooting guide!** Most problems have quick solutions:

### Quick Help
- **[FAQ & Troubleshooting Guide](./help/faq.md)** - Start here! Most issues are covered here
- **Authentication problems?** → [FAQ: Authentication Issues](./help/faq.md#authentication-issues)
- **Configuration problems?** → [FAQ: Configuration Issues](./help/faq.md#configuration-issues)
- **Tool/Query problems?** → [FAQ: MCP Tool Issues](./help/faq.md#mcp-tool-issues)

### Common Setup Hurdles
- **Can't find API Domain?** → [FAQ: Finding API Domain](./help/faq.md#q-i-cant-find-my-api-domain-or-scope-prefix-where-is-it)
- **Browser didn't open?** → [FAQ: No auth popup](./help/faq.md#no-auth-popup-appears)
- **401/403 errors?** → [FAQ: 401/403 errors](./help/faq.md#401403-errors)
- **Don't have Client Application?** → [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

## Debugging

For interactive testing and debugging, use the MCP Inspector. It provides a web interface where you can test MCP tools directly:

```bash
# With cloned repository
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --api-domain "..."

# Or with npx (published package)
npx @modelcontextprotocol/inspector npx @egain/egain-mcp-server start --api-domain "..."
```

The inspector opens in your browser where you can:
- See all available tools
- Call tools with custom parameters
- View request/response details
- Test queries like "get my portals" or "show popular articles"


## Resources & Support
### Help Guides
- **[FAQ & Troubleshooting](./help/faq.md)**
- [What is MCP?](./help/what-is-mcp.md)
- [Authentication Deep Dive](./help/authentication.md)
- [Claude Example](./help/claude-example.md)
- [Cursor Example](./help/cursor-example.md)
- [BYO MCP Client LLM](./help/byo_llm_demo.ipynb)  
  
MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)

### Contact
* Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
* MCP Support: eloh@egain.com
* eGain Support: [Support Portal](https://support.egain.com)
<!-- Placeholder for Future Speakeasy SDK Sections -->
