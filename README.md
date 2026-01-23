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

This server implements the Model Context Protocol (MCP) for eGain Knowledge, exposing Portal Manager, Search, Retrieve, and Answers as a single MCP endpoint for AI clients.

It enables tools like Claude Desktop, Cursor, and VS Code to browse portals, read articles, search knowledge, submit suggestions, and generate AI-powered answers — all using the user’s existing eGain permissions.
> ⚠️ This MCP server is built exclusively for **eGain v4 APIs**. Earlier API versions are not supported. For more details about the v4 APIs, visit our [developer portal](https://apidev.egain.com/).


https://github.com/user-attachments/assets/1b6c8aab-eb50-4f9e-8dfc-2a9ac4fb6518

<!-- No Summary [summary] -->

Learn more about the tools and usage of the MCP in the [eGain MCP guide](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

<!-- No Table of Contents [toc] -->

### Prerequisites
- **Node.js 20+** (required to run the MCP server)
- eGain platform version **21.22 or newer**
- AI Services enabled for the tenant and target portal
- Knowledge portal and article content available
- Supported browser: Chrome, Edge, or Brave
- A client application configured in your eGain tenant

> ℹ️ MCP access always mirrors the authenticated user’s permissions (portal and article visibility).

## Installation

https://github.com/user-attachments/assets/2cecc8ff-6a90-4c26-92e1-6720f9124297

### Step 1: Configure your MCP client (Cursor, Claude Desktop, Windsurf, VS Code, etc.) with the following:

**Note:** Replace `"..."` with your API domain (instructions in **Step 2**).

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

### Step 2: Find your API domain using the eGain Administrator Console
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Click `Metadata`. The value `API Domain` is detailed in the window.  

Please contact your eGain PA if you do not have access to these admin-only details.

That's it! The MCP server will be automatically downloaded and run when needed.

If you're having trouble configuring your MCP client, see these detailed guides:
- Claude quick-start and example queries: [Claude Guide](./help/claude-example.md)
- Cursor quick-start and example queries: [Cursor Guide](./help/cursor-example.md)

### Step 3: Make a query and authenticate

Once you've set up the server on your client, **run your first eGain MCP query** and a browser window will popup for authentication.

**Requirements for authentication:**
- A client application configured in your eGain tenant (some environments may have a pre-configured **APIs Trial** client app)
- A supported browser (Chrome, Edge, or Brave — Safari is not supported)
- Delegated API permissions in your client app:
  - `knowledge.portalmgr.manage`
  - `knowledge.portalmgr.read`
  - `core.aiservices.read`

You'll need to enter your authentication configuration values in the browser form. For a tutorial, see the [Authentication Deep Dive](./help/authentication.md). If you need to create a client application, see the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) — **be sure to select SPA (Single Page Application) as the platform type**. Please contact your eGain PA if you do not have access to client application settings.

<!-- No Installation [installation] -->

## 🆘 Having Issues?

Start here — most problems are covered in the FAQ:

- **[FAQ & Troubleshooting](./help/faq.md)**
- Authentication issues → [Authentication FAQ](./help/faq.md#authentication-issues)
- Configuration issues → [Configuration FAQ](./help/faq.md#configuration-issues)
- MCP tool issues → [Tool FAQ](./help/faq.md#mcp-tool-issues)

### Token issues (expired or stuck)

If authentication fails after it previously worked, delete cached token files and retry:

```bash
# Search your home directory for both token files
find ~ -name ".bearer_token*" 2>/dev/null
# Remove both token files
rm /path/to/.bearer_token*
```

## Debugging

Use the MCP Inspector for interactive testing:

```bash
npx @modelcontextprotocol/inspector npx @egain/egain-mcp-server start --api-domain "..."
```

## Resources & Support
### Help Guides
- **[FAQ & Troubleshooting](./help/faq.md)**
- [What is MCP?](./help/what-is-mcp.md)
- [Authentication Deep Dive](./help/authentication.md)
- [Claude Example](./help/claude-example.md)
- [Cursor Example](./help/cursor-example.md)
- [BYO MCP Client LLM](./help/byo_llm_demo.ipynb)  
  

### Contact
* Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
* eGain Support: [Support Portal](https://support.egain.com)
* MCP Support: eloh@egain.com

<!-- Placeholder for Future Speakeasy SDK Sections -->
MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)
