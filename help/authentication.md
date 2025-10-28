# Authentication Deep Dive

There are two ways of authenticating, **PKCE Authentication Flow** or **Direct Access Token**. Both ways are very similar and require a client app to work with. If you do not already have a client app set up, please follow the the [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).
> Ensure your client app has these API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## PKCE Authentication Flow (Recommended)
Place a `.env` file in the **project root** such as this example:
```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
```

Note: `SCOPE_PREFIX` is required for Commercial environments. 

To find your tenant-specific values, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application and click `Metadata`.
3. Map the metadata to env keys:
   - Authorization URL → `AUTH_URL`
   - Token URL → `ACCESS_TOKEN_URL`
   - Domain URL → `EGAIN_URL`
   - Scope Prefix → `SCOPE_PREFIX`
   - Client ID → `CLIENT_ID`
   - Redirect URL → `REDIRECT_URL`
4. The --api-domain you will need in the configuration is also found under the `Metadata` details.

Reference: [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

1) Start your MCP client or run the login helper without providing `--access-token`:
```bash
# Launch a manual login anytime
node scripts/login.js
```
2) Complete the browser popup. The token is saved to `.bearer_token` with metadata in `.bearer_token_metadata` at the project root.

3) If you do not want to wait until a token expires to login again, manually clear saved token files with:
```bash
node scripts/logout.js
```
This removes: `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json`.

Notes: Tokens auto‑reuse until near expiry; you’ll be prompted to sign in again when making your next request. You can clear tokens anytime.

## Direct Access Token
Prefer a one‑time token or bypass the popup? Pass a bearer token via `--access-token`. To generate this token, see **Step 3** of [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

Configure your client (Cursor, Claude, etc.) like this:
```json
{
  "mcpServers": {
    "EgainMcp": {
      "command": "node",
      "args": [
        "./bin/mcp-server.js",
        "start",
        "--api-domain", "EGAIN_URL",
        "--access-token", "YOUR_ACCESS_TOKEN"
      ]
    }
  }
}
```

## Troubleshooting
- 401/403 errors: verify token validity and client app scopes/API access.
- Browser didn’t open: ensure Chrome is installed and the system can launch it.
- `.env` not loaded: confirm you’re running from project root and values are correct.
- Still stuck: run logout, then login; verify `AUTH_URL`/`ACCESS_TOKEN_URL` policy names.
- Direct token management: when the token expires, update your config with a new token.
