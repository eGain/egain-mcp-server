## Browser-Based Configuration (Recommended)

The eGain MCP uses a **browser-based configuration interface** that opens automatically when you first authenticate. This is the recommended and preferred method.

**Important:**
- **Client application required** - You'll need a PKCE-friendly client application configured in your eGain tenant. Some environments may have a pre-configured client app named **APIs Trial** that you can use. If you need to create one, see the [API Authentication Guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/) — **be sure to select SPA (Single Page Application) as the platform type**.
- **Safari browser is not supported** - Safari has limited private browsing support via command line, which is required for secure OAuth flows. Please use Chrome, Edge, or Brave browser for authentication.
- Configuration is securely stored in `~/.egain-mcp/config.json` (user-only permissions).

When you first use the MCP, a browser window will open with a configuration form. You'll need the following values from your eGain Administrator Console:

1. Sign in as a Partition Admin → go to `Partition` → `Integration` → `Client Application`.
2. Open the client application of choice (if available, you may see **APIs Trial** which is pre-configured for MCP use). Note these values:
   - **Client ID** - Copy this value
   - **Redirect URL** - Must exactly match what you enter in the config form
3. Exit to the Client Application menu and click `Metadata`. Note these values:
   - **Auth URL** - OAuth2 authorization endpoint
   - **Access Token URL** - OAuth2 token endpoint
   - **API Permission Prefix** - Use as Scope Prefix (if present in Metadata)
   - **API Domain** - Used for the `--api-domain` flag in MCP configuration

> Ensure your client app has these delegated API permissions: `knowledge.portalmgr.manage`, `knowledge.portalmgr.read`, `core.aiservices.read`.  
> Please use user actor protected PKCE flow to only allow users to perform actions through the MCP.

For detailed authentication instructions, see [Authentication Deep Dive](./authentication.md).

Done? Return to the main README [here](../README.md).