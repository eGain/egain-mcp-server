# Claude Example: Setup to First Query

This is a precise, click-by-click guide starting immediately after you clone the repo. It uses stdio and the PKCE login flow. Download the Claude Desktop to run this example

## 1) After cloning the repo
From the project root:

```bash
npm install
npm run build
```

## 2) Create .env for PKCE authentication pop-up
Create a `.env` in the **project root** with these keys (examples shown):
```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
```
To find these values, see [Authentication Deep Dive](./authentication.md). Client application required API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## 3) (Optional) Verify auth separately
You can trigger the PKCE login flow before wiring Claude to give it a try:

```bash
node scripts/login.js   # opens Chrome, completes OAuth, saves token locally
# To clear tokens and force fresh login later:
node scripts/logout.js
```

This creates `.bearer_token` and `.bearer_token_metadata` in the repo root.

## 4) Configure Claude Desktop for stdio
Open Claude Desktop → `Settings` → `Developer` → `Edit Config` → open `claude_desktop_config.json`. Use this JSON as a reference for the configuration:

```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain",
        "api.aidev.egain.cloud" // Replace with your API domain
      ]
    }
  }
}
```

- `--api-domain` controls which API host is used. If omitted, the default is `api.aidev.egain.cloud`. This domain is used in the Rigel setups.

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
