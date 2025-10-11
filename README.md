# egain-mcp

Model Context Protocol (MCP) Server for the *eGain* API.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript"><img src="https://www.speakeasy.com/assets/badges/built-by-speakeasy.svg" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>

> ⚠️ **Development Status**: This MCP server is currently in active development. Features and APIs may change without notice.

<br /><br />


<!-- Start Summary [summary] -->
## Summary

eGain API: Use the eGain API to get information about the eGain platform.

## Features

This MCP server provides access to the eGain Knowledge Portal Manager APIs, enabling you to:

- 🔍 **Search & Retrieve**: Get articles, announcements, and popular content from eGain portals
- 🤖 **AI-Powered Answers**: Leverage eGain's AI services for intelligent question answering
- 📝 **Content Management**: Create suggestions and manage knowledge base content
- 🌐 **Portal Access**: Discover and access multiple eGain portals
- 🔐 **Secure Authentication**: OAuth2 authentication with automatic token management
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [egain-mcp](#egain-mcp)
  * [Features](#features)
  * [Installation](#installation)
  * [Environment Configuration](#environment-configuration)
  * [Quick Start](#quick-start)
  * [Authentication & Logout](#authentication-logout)
  * [Development](#development)
  * [Troubleshooting](#troubleshooting)
  * [Support](#support)
  * [Contributions](#contributions)

<!-- End Table of Contents [toc] -->

<!-- Start Installation [installation] -->
## Installation

> [!TIP]
> To finish publishing your MCP Server to npm and others you must [run your first generation action](https://www.speakeasy.com/docs/github-setup#step-by-step-guide).
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
        "--server-index",
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
        "--server-index",
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
npx egain-mcp start --server-index ...
```

For a full list of server arguments, run:

```
npx egain-mcp --help
```

</details>
<!-- End Installation [installation] -->

## Environment Configuration

Before using the eGain MCP server, you need to set up your authentication credentials in a `.env` file.

### Setting up your .env file

Create a `.env` file in your project root with the following variables:

```bash
# eGain API Configuration
EGAIN_API_DOMAIN=your-api-domain.com
EGAIN_ACCESS_TOKEN=your-access-token-here

# Optional: Force re-authentication (set to 'true' to force login)
EGAIN_FORCE_LOGIN=false
```

### Getting your credentials

1. **API Domain**: This is your eGain instance domain (e.g., `aiservices-qe.ezdev.net`)
2. **Access Token**: Your eGain API access token for authentication

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `EGAIN_API_DOMAIN` | Your eGain API domain | Yes | - |
| `EGAIN_ACCESS_TOKEN` | Your eGain API access token | Yes | - |
| `EGAIN_FORCE_LOGIN` | Force re-authentication on startup | No | `false` |

### Security Note

⚠️ **Important**: Never commit your `.env` file to version control. Add it to your `.gitignore` file to keep your credentials secure.

```bash
# Add to .gitignore
.env
.env.local
.env.*.local
```

## Quick Start

1. **Install the MCP server**:
   ```bash
   npm install -g egain-mcp
   ```

2. **Set up your environment**:
   Create a `.env` file with your eGain credentials (see [Environment Configuration](#environment-configuration))

3. **Start the server**:
   ```bash
   npx egain-mcp start --server-index 0
   ```

4. **Test the connection**:
   The server will automatically authenticate and be ready to use with your MCP client.

## Authentication & Logout

This MCP server uses OAuth2 authentication with automatic token management:

- **Automatic Login**: The server will automatically open a browser window for authentication when needed
- **Token Expiration**: Tokens are automatically refreshed when they expire
- **Manual Logout**: Use the logout command to clear all authentication data and force a fresh login

### Logout Command

To log out and clear all cached authentication data:

```bash
npm run logout
```

This command will:
- Remove stored bearer tokens (`.bearer_token` and `.bearer_token_metadata`)
- Clear the portal cache (`portals_cache.json`)
- Force a fresh login on the next MCP request

**Note**: The old `EGAIN_FORCE_LOGIN` environment variable has been removed in favor of this cleaner logout mechanism.

## Development

Run locally without a published npm package:
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Set up your `.env` file with your eGain credentials (see [Environment Configuration](#environment-configuration))
5. Run `node ./bin/mcp-server.js start --server-index ...`
To use this local version with Cursor, Claude or other MCP Clients, you'll need to add the following config:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--server-index",
        "..."
      ]
    }
  }
}
```

Or to debug the MCP server locally, use the official MCP Inspector: 

```bash
npx @modelcontextprotocol/inspector node ./bin/mcp-server.js start --server-index ...
```


### Cloudflare Deployment

To deploy to Cloudflare Workers:

```bash
npm install 
npm run deploy
```

To run the cloudflare deployment locally:

```bash
npm install 
npm run dev
```

The local development server will be available at `http://localhost:8787`

Then install with Claude Code CLI:

```bash
claude mcp add --transport sse EgainMcp http://localhost:8787/sse --header "authorization: ..."
```





## Troubleshooting

### Common Issues

**Authentication Errors**
- Ensure your `.env` file is properly configured with valid credentials
- Check that your access token has the necessary permissions
- Try running `npm run logout` to clear cached authentication data

**Connection Issues**
- Verify your API domain is correct and accessible
- Check your network connection and firewall settings
- Ensure the server index matches your eGain instance configuration

**MCP Client Issues**
- Restart your MCP client after making configuration changes
- Check that the MCP server is running and accessible
- Verify the server configuration in your MCP client settings


## Support

For technical support and questions about this MCP server:

- **Primary Support**: [Emily Loh] - [eloh@egain.com]
- **Documentation**: [GitHub Repository]
- **Issues**: [GitHub Issues]

## Contributions

While we value contributions to this MCP Server, the code is generated programmatically. Any manual changes added to internal files will be overwritten on the next generation. 
We look forward to hearing your feedback. Feel free to open a PR or an issue with a proof of concept and we'll do our best to include it in a future release. 

### MCP Server Created by [Speakeasy](https://www.speakeasy.com/?utm_source=egain-mcp&utm_campaign=mcp-typescript)
