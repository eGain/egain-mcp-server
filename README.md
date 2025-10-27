# egain-mcp

Model Context Protocol (MCP) Server for the *egain-mcp* API.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>
<br />

> ⚠️ **Development Status**: This MCP server is currently in active development. Features and APIs may change without notice.


<!-- Start Summary [summary] -->
## Summary

eGain Portal, Retrieve, Search, Answers APIs: Enterprise knowledge APIs for managing portals, searching content, retrieving AI-powered answers, and accessing content chunks for custom integrations.
<!-- End Summary [summary] -->

### What is the eGain MCP?

The Model Context Protocol (MCP) server exposes eGain knowledge APIs to MCP‑enabled clients (Claude Desktop, Cursor, etc.). It unifies semantic search, chunk retrieval, and Certified/Generative Answers so you can access your knowledge base directly from AI tools.

- What it can do:
  - Use tools like `getPortals`, `getPopularArticles`, `querySearch`, `queryRetrieve`, and `queryAnswers`
  - Return Certified/Generative answers with references and scores, or raw chunks for RAG
  - Enforce portal permissions with secure, token‑based access

Learn more: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/)

🎥 [Watch the demo on Vimeo](https://vimeo.com/showcase/11942379?video=1129942385)

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [egain-mcp](#egain-mcp)
  * [Development](#development)
  * [Authentication](#authentication)
  * [Installation](#installation)
  * [Help Guides](#help-guides)
  * [Contributions](#contributions)

<!-- End Table of Contents [toc] -->

## Development

Run locally without a published npm package:
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Run `node ./bin/mcp-server.js start --api-domain "..." --access-token "..."`

To use this local version with Cursor, Claude or other MCP Clients, you'll need to add the following config:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "...",
        "--access-token",
        "..."
      ]
    }
  }
}
```

This is my recommended method of using MCP. Claude and Cursor are the easiest to work with and are very MCP friendly. It is also recommended you omit the  `--access-token` flag and follow the steps for [Authentication](#authentication) to setup smart authentication.

To debug the MCP server locally, use the official MCP Inspector: 

```bash
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --api-domain "..." --access-token "..."
```

## Authentication

If you omit the `--access-token` flag, the server will use the interactive authentication flow. This requires a fully configured `.env` file in your project root.

Place a `.env` file with the following keys (values are examples/placeholders):

```
EGAIN_ENVIRONMENT_URL="https://your-tenant.knowledge.ai"
EGAIN_CLIENT_ID="00000000-0000-0000-0000-000000000000"
EGAIN_REDIRECT_URI="https://oauth.pstmn.io/v1/callback"
AUTH_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/authorize?p=B2C_1_signin"
ACCESS_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1_signin"
EGAIN_SCOPE_PREFIX="https://your-tenant.scope.prefixvalue.com"
```

Notes:
- If `--access-token` is provided (or `EGAIN_MCP_ACCESS_TOKEN` is set), that token is used directly and the `.env` is not required.
- Without `--access-token`, you must provide all required `.env` values above for authentication to occur. The flow will open a browser window, and a bearer token will be saved locally for reuse.
- **`EGAIN_CLIENT_SECRET`**: This field is included in the configuration but is not technically required for the authentication flow to work. You can leave it as an empty string if not needed.
- **`EGAIN_SCOPE_PREFIX`**: This is not required for Rigel setups. You can omit this or leave it as an empty string for Rigel environments.
- If you install via the DXT (Desktop Extension) file instead of configuring with a JSON `mcpServers` entry, a local `.env` file will not be read because `.env` files are excluded from the packaged extension. You must provide the required access token from within Claude Desktop Extensions settings.

### Required API permissions
Ensure your client app (and issued token) has the following API permissions:
- `knowledge.portalmgr.manage`
- `knowledge.portalmgr.read`
- `core.aiservices.read`

For more details on eGain authentication, see [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

### Platform prerequisites
This MCP surfaces existing eGain APIs. If your tenant does not have required services provisioned or data available, related tools will not function:
- AI Services (Search/Retrieve/Answers) require AI indexing to be enabled and content indexed. Without an index, `querySearch`, `queryRetrieve`, and `queryAnswers` will fail or return empty results.
- Knowledge Portal Manager endpoints require a Knowledge Base and at least one portal with accessible content. Without this, `getPortals`, `getPopularArticles`, `getAnnouncements`, and `getArticle` will not return data.
If you’re unsure about your tenant’s setup, consult your eGain admin to confirm provisioning and access.

If you want to force a fresh login or clear local token data without waiting for token expiry, you can run the helper scripts:

```bash
# Force login (interactive OAuth flow)
node ./scripts/login.js

# Force logout (clears saved token files)
node ./scripts/logout.js
```

## Help Guides

Helpful walkthroughs live in the `help/` folder:

- [What is MCP?](./help/what-is-mcp.md)
- [Authentication Deep Dive](./help/authentication.md)
- [Claude Example: Setup to First Query](./help/claude-example.md)
- [FAQ](./help/faq.md)

<!-- Placeholder for Future Speakeasy SDK Sections -->

<!-- Start Installation [installation] -->
## Installation

<details>
<summary>DXT (Desktop Extension)</summary>

Install the MCP server as a Desktop Extension using the pre-built [`mcp-server.dxt`](./mcp-server.dxt) file:

Simply drag and drop the [`mcp-server.dxt`](./mcp-server.dxt) file onto Claude Desktop to install the extension.

The DXT package includes the MCP server and all necessary configuration. Once installed, the server will be available without additional setup.

> [!NOTE]
> DXT (Desktop Extensions) provide a streamlined way to package and distribute MCP servers. Learn more about [Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions).

</details>

<details>
<summary>Cursor</summary>

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=EgainMcp&config=eyJtY3BTZXJ2ZXJzIjp7IkVnYWluTWNwIjp7InR5cGUiOiJtY3AiLCJ1cmwiOiJodHRwczovL2V4YW1wbGUtY2xvdWRmbGFyZS13b3JrZXIuY29tL21jcCIsImhlYWRlcnMiOnsiYXV0aG9yaXphdGlvbiI6IiR7RUdBSU4tTUNQX0FDQ0VTU19UT0tFTn0ifX19fQ==)

Or manually:

1. Open Cursor Settings
2. Select Tools and Integrations
3. Select New MCP Server
4. If the configuration file is empty paste the following JSON into the MCP Server Configuration:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "type": "mcp",
      "url": "https://example-cloudflare-worker.com/mcp",
      "headers": {
        "authorization": "${EGAIN-MCP_ACCESS_TOKEN}"
      }
    }
  }
}
```

</details>

<details>
<summary>Claude Code CLI</summary>

```bash
claude mcp add --transport sse EgainMcp undefined/sse --header "authorization: ..."
```

</details>
<details>
<summary>Windsurf</summary>

Refer to [Official Windsurf documentation](https://docs.windsurf.com/windsurf/cascade/mcp#adding-a-new-mcp-plugin) for latest information

1. Open Windsurf Settings
2. Select Cascade on left side menu
3. Click on `Manage MCPs`. (To Manage MCPs you should be signed in with a Windsurf Account)
4. Click on `View raw config` to open up the mcp configuration file.
5. If the configuration file is empty paste the full json
```
{
  "mcpServers": {
    "EgainMcp": {
      "command": "npx",
      "args": [
        "egain-mcp",
        "start",
        "--server",
        "...",
        "--api-domain",
        "...",
        "--access-token",
        "..."
      ]
    }
  }
}
```
</details>
<details>
<summary>VS Code</summary>

Refer to [Official VS Code documentation](https://code.visualstudio.com/api/extension-guides/ai/mcp) for latest information

1. Open [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette)
1. Search and open `MCP: Open User Configuration`. This should open mcp.json file
2. If the configuration file is empty paste the full json
```
{
  "mcpServers": {
    "EgainMcp": {
      "command": "npx",
      "args": [
        "egain-mcp",
        "start",
        "--server",
        "...",
        "--api-domain",
        "...",
        "--access-token",
        "..."
      ]
    }
  }
}
```

</details>


<details>
<summary> Stdio installation via npm </summary>
To start the MCP server, run:

```bash
npx egain-mcp start --server ... --api-domain ... --access-token ...
```

For a full list of server arguments, run:

```
npx egain-mcp --help
```

</details>
<!-- End Installation [installation] -->

## Contributions

While we value contributions to this MCP Server, the code is generated programmatically. Any manual changes added to internal files will be overwritten on the next generation. 
We look forward to hearing your feedback. Feel free to open a PR or an issue with a proof of concept and we'll do our best to include it in a future release. 

### MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)

### Disclaimer

This MCP server is an early preview and is not production‑ready. It is provided as a “taste test” so you can explore the direction while we continue to stabilize, complete features, and add tests. By Speakeasy standards this implementation is not yet finalized; expect limited functionality, frequent changes, and potential breaking updates.

### Technical Support

For technical support and questions about this MCP server:

Primary Support: Emily Loh — eloh@egain.com

Or you can open an issue via the repository’s Issues tab.
