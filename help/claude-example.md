# Claude Example: Setup to First Query

This is a precise, click-by-click guide starting immediately after you clone the repo. It uses stdio and the interactive login flow (no DXT file). Download the Claude Desktop to run this example

## 1) After cloning the repo
From the project root:

```bash
npm install
npm run build
```

## 2) Create .env for interactive authentication
Create a `.env` in the project root with these keys (examples shown):

```
EGAIN_ENVIRONMENT_URL="https://your-tenant.knowledge.ai"
EGAIN_CLIENT_ID="00000000-0000-0000-0000-000000000000"
EGAIN_REDIRECT_URI="https://oauth.pstmn.io/v1/callback"
AUTH_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/authorize?p=B2C_1_signin"
ACCESS_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1_signin"
EGAIN_SCOPE_PREFIX="https://your-tenant.scope.prefixvalue.com"
```

How to find these values: see `help/authentication.md` or the Admin Console mapping. Required API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## 3) (Optional) Verify auth separately
You can trigger the interactive login before wiring Claude:

```bash
node ./scripts/login.js   # opens Chrome, completes OAuth, saves token locally
# To clear tokens and force fresh login later:
node ./scripts/logout.js
```

This creates `.bearer_token` and `.bearer_token_metadata` in the repo root.

## 4) Configure Claude Desktop for stdio
Open Claude Desktop → Settings → Extensions (MCP) → Add server → choose “Command”. Use this JSON as a reference for the configuration:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "api.aidev.egain.cloud"
      ]
    }
  }
}
```

Notes:
- Omit `--access-token` to enable interactive login. On first use, a Chrome popup will appear.
- `--api-domain` controls which API host is used. If omitted, the default is `api.aidev.egain.cloud`. This domain is used in the Rigel setups.
- Keep your `.env` in the project root; the server auto‑loads it during auth.

## 5) First query in Claude
Open a new Claude chat and try:

- "List the portals I can access." → uses `getPortals`.
- "Show popular articles for the Production portal." → uses `getPopularArticles` with `portalID`.
- "Search for 'reset password' in the Company portal." → uses `querySearch` with `q` and `portalID`.
- "Get the best answer for 'how to reset password' in portal PROD-1234." → uses `queryAnswers`.
- "Retrieve relevant chunks about SSO configuration in the Master portal." → uses `queryRetrieve`.

Tip: Start with "List the portals I can access" to discover valid `portalID`s and portal names.

## 6) Troubleshooting
- No auth popup: ensure Chrome is installed and `.env` values are correct.
- Still not authenticating: run `node ./scripts/logout.js` then retry; verify `AUTH_URL`/`ACCESS_URL` policy names.
- Empty results: confirm your tenant has AI indexing (for Search/Retrieve/Answers) and at least one accessible portal with content.

For more background on MCP and workflows, see the eGain MCP guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).
