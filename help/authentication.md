# Authentication Deep Dive

There are two ways of authenticating, **PKCE Authentication Flow** or **Direct Access Token**. Both ways are very similar and require a client app to work with. If you do not already have a client app set up, please follow the the [eGain Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).
> Ensure your client app has these API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

## PKCE Authentication Flow (Recommended)
Place a `.env` file in the **root** of this repo such as this example:
```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
```

Note:  
- `SCOPE_PREFIX`: Not required for Rigel environments. For commercial environments, use the value from Metadata (API Permission Prefix), or `api.egain.cloud/auth/` if not present.
- `CLIENT_SECRET`:
  - Not needed for public clients (PKCE), e.g., local login flows used by native/desktop apps and SPAs.
  - Required for confidential clients (server-side web apps/SSO) where the token endpoint expects a client secret.
  - If your organization uses a “local login” product/flow, it is typically a public PKCE app and does not need a secret.

To find your tenant-specific values, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application of choice. Map the values accordingly:
   - Client ID → `CLIENT_ID`
   - Secrets → `CLIENT_SECRET`
   - Redirect URL → `REDIRECT_URL`
3. Exit to the Client Application menu and click `Metadata`. Map the metadata to env keys:
   - Auth URL → `AUTH_URL`
   - Access Token URL → `ACCESS_TOKEN_URL`
   - API Permission Prefix → `SCOPE_PREFIX`
> Please use user actor protected PKCE flow to only allow users to perform actions through the MCP.
4. The `EGAIN_URL` is your base eGain instance URL and --api-domain flag you will need in the configuration is also found under the `Metadata` details as API Domain.
   - For Self Service, include the tenant path (e.g., `https://aidev.egain.cloud/a1b2`, `ai.egain.cloud/c2d3`).

Reference: [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

**Want to log in right away? Or test this login/logout flow?**  
1) Start your MCP client to make a query or run the login helper:
```bash
# Launch a manual login anytime
node scripts/login.js
```
2) Complete the browser popup. The token is saved to `.bearer_token` with metadata in `.bearer_token_metadata` at the repository root.

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
        "./bin/mcp-server.js", // Replace with absolute path, if needed
        "start",
        "--api-domain", "api.egain.cloud", // Replace with your API domain
        "--access-token", "YOUR_ACCESS_TOKEN"  // Replace with your access token
      ]
    }
  }
}
```