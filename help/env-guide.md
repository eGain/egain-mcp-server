## Create your .env file

Before creating the file, ensure you have an eGain OAuth client application (or locate an existing one) in your tenant. You will copy values from that client app’s details and Metadata. If you haven’t set this up yet, follow the steps in the [eGain Authentication Guide:](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) Create or find your client app. Please contact your eGain PA if you do not have access to client applications/the administration console.
> Note: Ensure your client app has these API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.

Place a file named `.env` in the root of this repository with the following keys (below is an example):

```
EGAIN_URL="https://aidev.egain.cloud/q8ml"
CLIENT_ID="abcdefgh-1234-5678-ijkl-123456789012345"
REDIRECT_URL="https://oauth.pstmn.io/v1/browser-callback"
AUTH_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/authorize"
ACCESS_TOKEN_URL="https://aidev.egain.cloud/system/auth/TMDEVEB123456-U/oauth2/token"
# Optional depending on environment/client type
# SCOPE_PREFIX="your-scope-prefix-if-required" 
# CLIENT_SECRET="only-for-confidential-clients"
```

To find your tenant-specific values, use the eGain Administrator Console to retrieve the correct values:
1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open your client application of choice. Map the values accordingly:
   - Client ID → `CLIENT_ID`
   - Secrets → `CLIENT_SECRET`
   - Redirect URL → `REDIRECT_URL`
3. Exit to the Client Application menu and click `Metadata`. Map the metadata to env keys:
   - Auth URL → `AUTH_URL`
   - Access Token URL → `ACCESS_TOKEN_URL`
   - API Permission Prefix → `SCOPE_PREFIX` (Not required for Rigel. For commercial, use this value or `api.egain.cloud/auth/` if not present.)  
> Please use user actor protected PKCE flow to only allow users to perform actions through the MCP.
4. The `EGAIN_URL` is your base eGain instance URL and --api-domain flag you will need in the configuration is also found under the `Metadata` details as API Domain.
   - For Self Service, include the tenant path (e.g., `https://aidev.egain.cloud/a1b2`, `ai.egain.cloud/c2d3`).

Done? Return to the main README [here](../README.md).

If you're unsure about whether to set `SCOPE_PREFIX`, whether your app is public PKCE (no `CLIENT_SECRET`) vs. confidential (requires `CLIENT_SECRET`), or which `REDIRECT_URL` to use (must exactly match the client app), refer to the client app's details/Metadata in the eGain Admin Console and the detailed steps in the [Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/). If still unsure, contact your eGain PA.