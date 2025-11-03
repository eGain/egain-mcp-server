# eGain MCP
<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>
<br />

> ⚠️ This MCP server is currently in active development. Features and APIs may change without notice.

## Overview

This server implements MCP for eGain Knowledge, unifying Portal Manager, Search, Retrieve, and Answers into a single endpoint your AI client can call. Use it from Claude Desktop, Cursor, and others to browse portals, read articles, search/retrieve content, submit suggestions, and get AI‑powered answers with your existing portal permissions.
<!-- No Summary [summary] -->

Learn more in the [eGain MCP guide](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).

<!-- No Table of Contents [toc] -->

### Prerequisites  
- eGain platform version 21.22 or newer.
- Access mirrors the user's permissions: MCP only sees content that user can see (portal/article visibility).
- AI Services must be enabled for your tenant and the target portal, or AI tools will not run.
- Knowledge content! I recommend at least 2 portals and 5 articles to give the MCP a try!

## Local Configuration
### Step 1: Clone repository and create a `.env` file.  
Clone this repository and create the `.env` file in the *root* of the folder to setup PKCE Authentication Flow. Below is an example of `.env`:
```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
```
- Ensure your client app has these API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

Stuck creating this file? Not sure if your application is a special case? Check out this [.env guide](./help/env-guide.md) for more details. For additional authentication details, see [Authentication Deep Dive](./help/authentication.md). Please contact your eGain PA if you do not have access to these values set up the `.env` file.

### Step 2: Run `npm` commands to install and build the MCP.   
```bash
npm install
npm run build
```

### Step 3 (optional): Run the server manually for standalone debugging  
Use this if you want to start the server outside of a client to see raw logs, pass extra flags (e.g., `--log-level debug`), or reproduce issues in isolation:

`node ./bin/mcp-server.js start --api-domain "..."`

Avoid running Step 3 and Step 4 at the same time. You don’t need this manual run unless you are debugging. Alternatively, launch with the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --api-domain "..."
```

### Step 4: Configuring with MCP Clients  
Firstly, to find your API domain, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Click `Metadata`. The value `API Domain` is detailed in the window.  

Please contact your eGain PA if you do not have access to these admin-only details.

To use this local version with **Cursor**, **Claude**, **Windsurf**, **VSC** or other MCP Clients, you'll need to add the following config:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js", // Replace with absolute path, if needed
        "start",
        "--api-domain",
        "..." // Replace with your API domain
      ]
    }
  }
}
```

See it in action:
- Watch a quick Claude demo: [Demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385)
- Claude quick-start and example queries: [Claude Guide](./help/claude-example.md)
- Cursor quick-start and example queries: [Cursor Guide](./help/cursor-example.md)

<!-- No Installation [installation] -->

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