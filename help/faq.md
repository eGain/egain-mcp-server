# FAQ

## Where is the access token stored?
In the project root as `.bearer_token` with metadata in `.bearer_token_metadata`. These are created by the interactive login flow or `scripts/login.js`.

## How do I force a fresh login?
Run:
```bash
node ./scripts/logout.js
```
This removes token/cache files (`.bearer_token`, `.bearer_token_metadata`, `portals_cache.json`) so the next request triggers login.

## I get 401/403 errors. What should I check?
- The token may be expired or missing scopes.
- `AUTH_URL`, `ACCESS_URL`, and policy names must be correct for your tenant.
- Confirm the `portalID` you’re querying is accessible to your user and the APIs you are accessing.

## Do DXT installs read my `.env`?
No. `.env` is not packaged into the DXT. Provide the access token inside the client’s MCP settings.

## How do I discover my `portalID`?
Call the `getPortals` tool first; it lists portals accessible to your user.

## Are there rate limits or quotas?
Yes, eGain APIs may enforce limits. If you see throttling, add retries/backoff and narrow queries.

## Which tools are available?
- `getPortals`, `getPopularArticles`, `getAnnouncements`
- `getArticle`
- `querySearch`, `queryRetrieve`, `queryAnswers`

## Do I need certain eGain services enabled for this MCP to work?
Yes. The MCP is a thin client over eGain APIs; if your tenant doesn’t have the underlying services/data, the corresponding tools will not work.
- `core.aiservices` endpoints require AI Services to be provisioned and content indexed. Without an index, `querySearch`, `queryRetrieve`, and `queryAnswers` will fail or return empty results.
- `knowledge.portalmgr` endpoints require a Knowledge Base and at least one portal with accessible content. Without this, tools like `getPortals`, `getPopularArticles`, `getAnnouncements`, and `getArticle` will not return data.
If you’re unsure, contact your eGain admin to verify provisioning and access for your tenant.

## Where can I get more help?
- Check `README.md`.
- Review the new guides under `help/`.
- Open an issue with logs and your environment details.

## Can we add our own APIs to this MCP?
There are no plans for this at the moment. For feedback or feature requests, please open an Issue in this repository.

## My request fails due to `$` vs `Dollar_` query parameter prefixes. Why?
This MCP uses the `Dollar_` prefix (for example, `Dollar_lang`) while many tools assume the `$` prefix (`$lang`). Some AI clients (e.g., Claude) may rewrite parameters to use `$` and ignore the documented `Dollar_` names. Ensure you send parameters exactly as documented with the `Dollar_` prefix.

## How do I clear my token and portal cache?
Use the logout script (also shown above):
```bash
node ./scripts/logout.js
```
It deletes `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json`. To log in again, either make any MCP request in your chat (you'll be prompted) or run:
```bash
node ./scripts/login.js
```

## What is my `API_DOMAIN` / `--api-domain`?
This value is found in the Client Application tab of the eGain Administration Console for your tenant. You can pass it via the CLI flag `--api-domain` or configure `API_DOMAIN` in SDK options. For details, see the eGain developer portal’s authentication guide: [API authentication guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

## What happens when my bearer token expires?
On the next request, the MCP will automatically prompt you to log in again. You generally don’t need to run the login/logout scripts manually unless you want to clear local token/cache files.

## I’m having trouble authenticating during chat. What could be wrong?
- Verify your credentials and environment configuration (including `.env` if your setup uses one).
- Some clients can behave unexpectedly if the password is incorrect or required values are missing. If it’s your first time, test a manual login:
```bash
node ./scripts/login.js
```
- If issues persist, clear cached files and retry:
```bash
node ./scripts/logout.js
```

## Why are there multiple authentication steps? Can we allow anonymous use?
To align with your organization’s security and access controls, the MCP authenticates you to the eGain platform and applies your permissions. This ensures content is personalized and restricted according to your role (e.g., PA, knowledge admin, agent). Anonymous access is not supported.

## Does interactive authentication work on Windows?
Yes. Interactive authentication works on both macOS and Windows. If you prefer, you can still supply a direct bearer token via `--access-token`.
