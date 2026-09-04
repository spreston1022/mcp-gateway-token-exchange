## MCP Gateway Token Exchange

An MCP Gateway fronting a self-hosted MCP server with a single `echo` tool,
gated by RBAC, that reaches it through a real per-user OAuth token exchange
— and that upstream server reaches its own downstream API through a second,
service-to-service exchange.

**Three hops, two token exchanges**

- `GET,POST /mcp` — the public MCP Gateway entry point (`McpProxyHandler`).
  MCP clients (Claude Desktop, Claude Code, Cursor, ...) connect here. Auth0
  browser login happens on this hop.
- `GET,POST /internal/echo/mcp` — the upstream MCP server (`mcpServerHandler`)
  that translates a `tools/call` for `echo` into a call to `/echo`. It's a
  genuine OAuth-protected resource with its own Auth0 audience: `/mcp`
  exchanges the caller's token for one scoped to this audience
  (`mcp-token-exchange-inbound`) before calling it — a real per-user
  credential, not a shared session.
- `POST /echo` — forwards (`urlForwardHandler`) to Zuplo's public echo
  service at `https://echo.zuplo.io`, a reflector that echoes back whatever
  it receives, including headers. This hop uses a second, service-to-service
  token exchange (client credentials) to reach it. Since echo.zuplo.io just
  reflects requests back, both exchanged tokens are visible end-to-end in the
  response's `headers.authorization` — handy for confirming the exchange
  actually happened. Point this at your own Auth0-checked backend for a real
  deployment.

**Policy chain on `/mcp`**:

1. `auth0-managed-oauth` (`mcp-auth0-oauth-inbound`) — sends the caller
   through Auth0's browser login; the gateway issues its own access token
   bound to this route.
2. `echo-mcp-token-exchange` (`mcp-token-exchange-inbound`, `authMode:
   "user-oauth"`) — exchanges the caller's token for one scoped to
   `/internal/echo/mcp`'s Auth0 audience, using the gateway's own client
   credentials (`clientRegistration.mode: "manual"`).
3. `echo-tool-rbac` (`mcp-capability-filter-inbound`, `accessControl.mode:
   "rolesAndGroups"`) — the RBAC gate. `mcp-auth0-oauth-inbound` normalizes
   the caller's Auth0 Roles onto `request.user.data.roles` as a plain array,
   regardless of which claim name the tenant's Login Action used. Only
   callers whose Auth0 Role includes `echo` see or can call the `echo` tool.

**Policy on `/internal/echo/mcp`**: `echo-mcp-jwt-auth` (`oauth-inbound`) —
validates the exchanged token against this audience.

**Policy on `/echo`**: `auth0-upstream-client-credentials`
(`upstream-oauth-client-credentials-inbound`) — a client-credentials grant
against Auth0 (`AUTH0_TOKEN_URL`, `AUTH0_M2M_CLIENT_ID`/`SECRET`, audience
`AUTH0_ECHO_API_AUDIENCE`), attached as the `Authorization` header.

**Auth0 setup required**

1. **Regular Web Application** ("Zuplo MCP Gateway") for browser login.
   Allow-list `https://<gateway-host>/__zuplo/oauth/callback` as a callback
   URL — identity-only, no API/audience needed.
2. **API** with identifier matching `AUTH0_ECHO_MCP_AUDIENCE` — represents
   `/internal/echo/mcp`. Authorize the gateway app (from step 1) to access it.
3. **API** with identifier matching `AUTH0_ECHO_API_AUDIENCE` — represents
   the downstream echo service.
4. **Machine-to-Machine Application**, authorized for the API from step 3,
   for the `/echo` hop's token exchange.
5. Assign Auth0 Roles to whoever should call `echo` — Role name must be
   `echo`. Requires a Login Action that forwards assigned Roles onto the ID
   token, e.g.:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const roles = event.authorization?.roles || [];
     api.idToken.setCustomClaim("https://zuplo.com/roles", roles);
   };
   ```
   The exact claim name doesn't matter — `mcp-auth0-oauth-inbound`
   normalizes it onto `request.user.data.roles` regardless.

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
