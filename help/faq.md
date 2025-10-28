# FAQ

**Q: My request fails before it even sends anything. Why?**  
A: AI agents sometimes deviate from MCP tool schemas (rename fields, skip required ones, change types). The MCP then rejects the call before it reaches the eGain API. Check logs for an MCP schema validation error (often shows which fields like `Dollar_lang` or `content` are missing/invalid). Use `--log-level debug` for more detail. Then prompt the AI agent which fields are missing/invalid and ask it to call the tool again with those fixes.

**Q: Where is the access token stored?**  
A: At the project root in `.bearer_token` with metadata in `.bearer_token_metadata` (created by the PKCE login flow or `scripts/login.js`).

**Q: What happens when my token expires?**  
A: With PKCE, you’ll be prompted to sign in again automatically on the next request. If you use a direct access token, generate a new token and update your config.

**Q: How do I force a fresh login or clear token/cache?**  
A: Run `node ./scripts/logout.js`. It removes `.bearer_token`, `.bearer_token_metadata`, and `portals_cache.json`. To log in again, make any MCP request or run `node ./scripts/login.js`.

**Q: How do I discover my `portalID`?**  
A: Call `getPortals` first; it lists portals accessible to your user.

**Q: What is my `--api-domain`?**  
A: Find it in the Client Application’s Metadata in the eGain Admin Console. Pass it via `--api-domain`. See: [API authentication guide](https://apidev.egain.com/developer-portal/get-started/authentication_guide/).

**Q: Which tools are available?**  
A: `getPortals`, `getPopularArticles`, `getAnnouncements`, `getArticle`, `makeSuggestion`, `querySearch`, `queryRetrieve`, `queryAnswers`.

**Q: Do I need certain services enabled for this MCP to work?**  
A: Yes. AI Services must be provisioned and content indexed for search/retrieve/answers; Knowledge Portal Manager requires a KB and at least one accessible portal. Otherwise related tools return empty or errors.

**Q: Are there rate limits or quotas?**  
A: Yes. Add retries/backoff and narrow queries if you see throttling.

**Q: I’m having trouble authenticating during chat. What should I try?**  
A: Verify credentials and `.env` (if used), test a manual login (`node ./scripts/login.js`), then try clearing cached files (`node ./scripts/logout.js`). If you failed to sign in the first time due to username or password mismatch, reattempt with a clean chat.

**Q: Why multiple authentication steps? Can we allow anonymous use?**  
A: Authentication applies your organizational permissions and ensures secure, role‑aware access. Anonymous access isn’t supported.

**Q: Does the PKCE authentication flow work on Windows?**  
A: Yes. PKCE works on both macOS and Windows. You can also use a direct bearer token via `--access-token`.
