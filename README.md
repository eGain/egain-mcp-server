# egain-mcp

Model Context Protocol (MCP) Server for the *egain-mcp* API.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>
<br />

> ⚠️ This MCP server is currently in active development. Features and APIs may change without notice.


## Prerequisites

- eGain platform version 21.22 or newer.
- Access mirrors the user's permissions: MCP only sees content that user can see (portal/article visibility).
- AI Services must be enabled for your tenant and the target portal, or AI tools will not run.


## Overview

eGain Portal, Retrieve, Search, Answers APIs: Enterprise knowledge APIs for managing portals, searching content, retrieving AI-powered answers, and accessing content chunks for custom integrations.
<!-- No Summary [summary] -->

### What is the eGain MCP?

Access eGain knowledge from MCP clients (Claude Desktop, Cursor, etc.) with user‑scoped permissions via `getPortals`, `getPopularArticles`, `getAnnouncements`, `getArticle`, `makeSuggestion`, `querySearch`, `queryRetrieve`, and `queryAnswers`.

Learn more in the [eGain MCP guide](https://apidev.egain.com/developer-portal/guides/mcp/mcp/) or watch the [demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385).

<!-- No Table of Contents [toc] -->

## Authentication
### PKCE Authentication Flow (Recommended)
Place a `.env` file in the **project root** such as this example:
```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
```
- Ensure your client app has these API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.
- `SCOPE_PREFIX`: This is required for Commercial environments. 
- Please contact your eGain PA if you do not have access to these values set up the `.env` file.

To find your tenant-specific values, see the [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/). For additional authentication details, see [Authentication Deep Dive](./help/authentication.md).

<!-- Placeholder for Future Speakeasy SDK Sections -->

## Local Configuration

Run locally without a published npm package:
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Run `node ./bin/mcp-server.js start --api-domain "..."`

To use this local version with **Cursor**, **Claude**, **Windsurf**, **VSC** or other MCP Clients, you'll need to add the following config:

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

To find your API domain, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application and click `Metadata`. The value `API Domain` is detailed in the window.

Please contact your eGain PA if you do not have access to these admin-only details.

To debug the MCP server locally, use the official MCP Inspector: 

```bash
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --api-domain "..."
```

<!-- No Installation [installation] -->

## Resources & Support
### Help Guides

Helpful walkthroughs live in the `help/` folder:

- [What is MCP?](./help/what-is-mcp.md)
- [Authentication Deep Dive](./help/authentication.md)
- [Full Setup & Claude Example](./help/claude-example.md)
- [FAQ](./help/faq.md)  
  
MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)

> ⚠️ Disclaimer: This MCP server is an early preview and is not production‑ready. It is provided as a “taste test” so you can explore the direction while we continue to stabilize, complete features, and add tests. Expect limited functionality, frequent changes, and potential breaking updates.

### Contact
* Issues: [GitHub Issues](https://github.com/eGain/egain-mcp-server/issues)
* MCP Support: eloh@egain.com
* eGain Support: [Support Portal](https://support.egain.com)