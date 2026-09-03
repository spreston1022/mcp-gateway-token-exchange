## MCP Gateway Token Exchange

An MCP Gateway fronting a self-hosted MCP server with a single `echo` tool,
gated by RBAC, that reaches its downstream API through an Auth0 token
exchange.

**Three hops, three trust boundaries**

- `GET,POST /mcp` — the public MCP Gateway entry point (`McpProxyHandler`).
  MCP clients (Claude Desktop, Claude Code, Cursor, ...) connect here. Auth0
  browser login happens on this hop.
- `GET,POST /internal/echo/mcp` — the real MCP server (`mcpServerHandler`)
  that translates a `tools/call` for `echo` into a call to `/echo`. Same
  project, same trust boundary as `/mcp` — no separate credential on this
  hop.
- `POST /echo` — forwards (`urlForwardHandler`) to Zuplo's public echo
  service at `https://echo.zuplo.io`, a reflector that echoes back whatever
  it receives, including headers. **This is where the Auth0 token exchange
  happens** — the credential the MCP server needs to call a downstream API
  it doesn't share a trust boundary with. Since echo.zuplo.io just reflects
  requests back, the exchanged token is visible in the response's
  `headers.authorization` — handy for confirming the exchange actually
  happened. Point this at your own Auth0-checked backend for a real
  deployment.

**Policy chain on `/mcp`**:

1. `auth0-managed-oauth` (`mcp-auth0-oauth-inbound`) — sends the caller
   through Auth0's browser login; the gateway issues its own access token
   bound to this route.
2. `echo-tool-rbac` (`mcp-capability-filter-inbound`, `accessControl.mode:
   "function"`) — the RBAC gate. Delegates to `modules/echo-access-control.ts`,
   which checks the caller's Auth0 Roles (surfaced via the tenant's Login
   Action as the namespaced claim `https://zuplo.com/roles`, not the
   default `roles` claim this policy's built-in `rolesAndGroups` mode
   expects). A custom function, not `rolesAndGroups` + `roleClaim`, because
   `roleClaim`'s handling of a namespaced claim that itself contains a dot
   (`zuplo.com`) isn't documented, and a resolver we write ourselves removes
   the ambiguity. Only callers whose Auth0 Role includes `echo` see or can
   call the `echo` tool; everyone else gets it filtered out of `tools/list`
   and blocked at invocation.

**Policy on `/echo`**:

1. `auth0-upstream-client-credentials`
   (`upstream-oauth-client-credentials-inbound`) — the token exchange: a
   client-credentials grant against Auth0 (`AUTH0_TOKEN_URL`,
   `AUTH0_M2M_CLIENT_ID`/`SECRET`, audience `AUTH0_ECHO_API_AUDIENCE`),
   attached as the `Authorization` header before forwarding to
   `echo.zuplo.io`.

**Auth0 setup required**

1. Create a **Regular Web Application** ("Zuplo MCP Gateway") for the
   browser-login leg. Allow-list `https://<gateway-host>/__zuplo/oauth/callback`
   (and the `localhost:9001` variant for local dev) as a callback URL — no
   API/audience needed for this app, it's identity-only.
2. Create an **API** (Applications > APIs) with an identifier matching
   `AUTH0_ECHO_API_AUDIENCE` — representing the downstream echo service
   (`https://echo.zuplo.io`, or your own backend once you swap it in).
3. Create a **Machine-to-Machine Application**, authorized for that API, for
   the `/echo` route's token exchange.
4. Assign Auth0 Roles (User Management > Users > [user] > Roles) to whoever
   should be able to call `echo` — the Role must be named `echo`. Add an
   Auth0 Action (Login flow) that forwards the user's assigned Roles onto
   the ID token as a namespaced custom claim:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const roles = event.authorization?.roles || [];
     api.idToken.setCustomClaim("https://zuplo.com/roles", roles);
   };
   ```
   `echo-access-control.ts` reads this claim via
   `request.user.data["https://zuplo.com/roles"]`.

Copy `.env.example` to your Zuplo project's environment configuration and
fill in the values (secrets in the secret store, not committed).

**Testing**: use the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector)
(`npx @modelcontextprotocol/inspector`) against `http://localhost:9000/mcp`
with transport type "Streamable HTTP", or connect a real MCP client (Claude
Desktop, Claude Code) to the same URL.

---

This is a Zuplo API that was created with
[`create-zuplo-api`](https://zuplo.com/docs).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:9000](http://localhost:9000) with your browser to see the
result.

You can start editing the API by modifying `config/routes.oas.json`. The dev
server will automatically reload the API with your changes.

## Debugging

In VS Code, open **Run and Debug**, select **Launch & Attach Zuplo**, and click
the green play button.

For other editors and more details, see the
[debugging guide](https://zuplo.com/docs/articles/local-development-debugging).

## Learn More

To learn more about Zuplo, you can visit the
[Zuplo documentation](https://zuplo.com/docs).

To connect with the community join [Discord](https://discord.zuplo.com).
