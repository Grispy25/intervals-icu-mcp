# Intervals.icu Direct MCP (Cloudflare Worker)

Adapted from the user's Xert MCP project. **Read-only**. GitHub authentication restricted to the owner login in `src/index.ts` and `src/github-handler.ts`.

## Setup

1. Upload these project files into your **new** private `intervals-icu-mcp` GitHub repository. Do not change the working Xert project.
2. Cloudflare Dashboard → Workers & Pages → KV → Create namespace (e.g. `INTERVALS_MCP_OAUTH_KV`). Copy the new namespace ID into `wrangler.jsonc` at `REPLACE_WITH_NEW_KV_NAMESPACE_ID`.
3. In `wrangler.jsonc`, replace `YOUR_SUBDOMAIN` with your Cloudflare workers.dev subdomain. The public URL must match the actual worker URL.
4. In GitHub → Settings → Developer settings → OAuth Apps, register a **new** GitHub OAuth app. Homepage: `https://intervals-icu-mcp.YOUR_SUBDOMAIN.workers.dev` and callback: `https://intervals-icu-mcp.YOUR_SUBDOMAIN.workers.dev/callback` (replace subdomain first).
5. Cloudflare → Workers & Pages → Create Worker → Import Git repository, connect this new repository. If the dashboard prompts for build configuration, keep Worker entrypoint from `wrangler.jsonc` and use Wrangler deploy. If deployment fails because of missing secrets, configure the secrets and retry.
6. In the new Worker → Settings → Variables and Secrets, add **encrypted secrets** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY` (unique random secret) and `INTERVALS_API_KEY`. Never enter secrets into repository files or the chat. `COOKIE_ENCRYPTION_KEY` can be generated locally with a cryptographically secure random generator.
7. Connect `https://intervals-icu-mcp.YOUR_SUBDOMAIN.workers.dev/mcp` in ChatGPT as a custom MCP connector, if the feature is available on your plan/workspace. Authenticate using the authorized GitHub account.

### Test tools

- `connection_status`
- `get_activities` (oldest/newest YYYY-MM-DD)
- `get_activity_raw` (activity id, including intervals)
- `get_activity_intervals`
- `get_wellness`

**SFT limitation:** these tools return original activity JSON, not a guaranteed original SFT verdict. Whether Intervals.icu exposes the *complete* on-screen SFT assessment through its public API is not established.

**Security:** OAuth authorization is required and restricted to the owner's GitHub account. Intervals.icu's personal API key is held only as a Cloudflare secret. This initial version exposes raw activity and wellness JSON, so connect it only to trusted clients. Do not add wildcard proxy endpoints. No write tools are present.
