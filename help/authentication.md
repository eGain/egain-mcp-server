# Authentication Deep Dive

This server supports two modes:

1) Direct token: pass `--access-token`.
2) Interactive login: omit `--access-token` and use the `.env`-based OAuth flow.

## Required .env values
Place a `.env` in the project root with these keys (examples shown):

```
EGAIN_ENVIRONMENT_URL="https://your-tenant.knowledge.ai"
EGAIN_CLIENT_ID="00000000-0000-0000-0000-000000000000"
EGAIN_REDIRECT_URI="https://oauth.pstmn.io/v1/callback"
AUTH_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/authorize?p=B2C_1_signin"
ACCESS_URL="https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1_signin"
EGAIN_SCOPE_PREFIX="https://your-tenant.scope.prefixvalue.com"
```

### Find your .env values (Admin Console)
Use the eGain Administrator Console to retrieve the correct values:

1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application and click `Metadata`.
3. Map the metadata to env keys:
   - Authorization URL → `AUTH_URL`
   - Token URL → `ACCESS_URL`
   - Domain URL → `EGAIN_ENVIRONMENT_URL`
   - Scope Prefix → `EGAIN_SCOPE_PREFIX`
   - Client ID → `EGAIN_CLIENT_ID`
   - Redirect URL → `EGAIN_REDIRECT_URI`

Reference: [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/)

Notes:
- If you provide `--access-token`, `.env` is not required but token must be replaced manually when expired.
- `EGAIN_CLIENT_SECRET` is optional and can be empty if not used.
- `EGAIN_SCOPE_PREFIX` may be empty/omitted for Rigel environments.
- In DXT installs, `.env` is not bundled; provide the token in client settings instead.

### Required API permissions
Your client application/token must include these permissions:
- `knowledge.portalmgr.manage`
- `knowledge.portalmgr.read`
- `core.aiservices.read`

## Interactive login flow
When you omit `--access-token`, the server triggers a browser-based OAuth flow and saves a bearer token locally for reuse.

You can also force the flow manually:

```bash
node ./scripts/login.js
```

This calls the `AuthenticationHook.authenticate()` behind the scenes and persists the token for future requests.

### Token expiry and automatic re‑auth
When your token expires, your MCP client will prompt you to sign in again automatically. You do not need to run the scripts for normal use. The `login`/`logout` scripts are optional conveniences for development (e.g., forcing a fresh login or clearing local state).

## Logging out / clearing tokens
To clear saved token files and force a fresh login on the next request:

```bash
node ./scripts/logout.js
```

This removes the following files from the project root if they exist:
- `.bearer_token`
- `.bearer_token_metadata`
- `portals_cache.json`

## Troubleshooting
- 401/403 errors: verify the token has not expired and your scopes are correct.
- Browser didn’t open: ensure a supported browser (e.g., Chrome) is installed and the system can launch it.
- `.env` not loaded: confirm you’re running the server from the project root and values are correct.
- Still stuck: run logout, then login again; double‑check tenant URLs and policy names in `AUTH_URL`/`ACCESS_URL`.
