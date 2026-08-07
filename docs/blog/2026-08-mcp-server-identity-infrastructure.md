# Building an MCP server for identity infrastructure — a case study

Every AI product that has "chat with your data" as a feature ends up building the same three things: a way to enumerate what's connectable, a way to authenticate against it, and a way to describe what the model is allowed to do with it. MCP (Model Context Protocol) is the pattern that stops each company from re-inventing this stack. Instead of writing a custom "Claude connector" and a custom "Cursor connector" and a custom "whatever-comes-next" connector, you write **one** MCP server, and every MCP-aware client can drive it.

The interesting angle for a security-focused SaaS: turn your own admin surface into a set of MCP tools. Not "generate marketing copy about your product," but "let Claude read the tenant users, list the dormant service accounts, generate a policy, and trigger an access review — with real credentials, against real infrastructure, from Claude Desktop." That's what this post walks through.

Full code: `mcp-server/` in [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite) (about to become its own submodule at [ElwinErnst/sytadel-mcp-server](https://github.com/ElwinErnst/sytadel-mcp-server)).

---

## Why MCP is the right primitive here

There are three ways to give Claude access to a system:

1. **Prompt-embed the data.** Dump the JSON into the context window. Works for one-off analyses; falls apart for anything larger than a snippet, and every re-run pays for the same tokens.
2. **LLM in the request path.** Every action becomes an inference call. Latency, cost, non-determinism. This is what the [session anomaly classifier](./2026-08-llm-anomaly-classifier.md) and the [policy generator](./2026-08-nl-to-rbac-policy-generator.md) do — and it's the right pattern for narrow, high-signal decisions.
3. **LLM as a driver.** The LLM sits in a chat client, decides *which* actions to call, and consumes structured responses. MCP lives here. The server side is deterministic; the model just orchestrates.

For an identity + access surface, driver-mode is the correct fit. The operations themselves (list users, revoke access, generate policy, run review) are already implemented as clean, deterministic HTTP endpoints. What was missing is a chat-friendly wrapper that a model can *discover* and *call* without a human writing curl commands.

The rule I settled on: **MCP tools should wrap existing endpoints, not add business logic.** The MCP server is a thin adapter, not a second brain. If a tool needs a new capability, that capability belongs in the backend service first — the MCP server just exposes it.

---

## The 5 tools

```
┌─────────────────────────────────────────────────────────────────┐
│ list_tenant_users        → GET  /tenants/:id/memberships         │
│ list_service_accounts    → GET  /tenants/:id/client-apps         │
│ query_session_anomalies  → GET  /sessions/anomalies              │
│ generate_policy          → POST /policies/generate               │
│ run_access_review        → POST /tenants/:id/access-review/run   │
└─────────────────────────────────────────────────────────────────┘
```

Four of them are pure reads. `generate_policy` calls the [LLM policy compiler](./2026-08-nl-to-rbac-policy-generator.md) — it's read-only in the sense that it doesn't apply the policy, just returns a compiled JSON. `run_access_review` triggers the [access review pipeline](./2026-08-ai-driven-access-review.md) — creates a row, waits for Claude, returns the report + recommendations.

Each tool is defined with a Zod schema for input validation:

```typescript
const generatePolicy: ToolDef = {
  name: 'generate_policy',
  description:
    'Compile a natural-language RBAC intent (e.g. "OWNER can do anything, MEMBER can only GET /vaults, default deny") into a Sytadel PolicySet JSON. Returns policy, warnings, cost, tokens, latency. Read-only: the compiled policy is NOT applied — call PUT /policies/:tenantId separately to enforce it.',
  inputSchema: z.object({ intent: z.string().min(3).max(1000) }).strict(),
  async run(client, input) {
    const parsed = z
      .object({ intent: z.string().min(3).max(1000) })
      .parse(input);
    return client.generatePolicy(parsed.intent);
  },
};
```

The **description is the API contract for the model.** Two lessons from writing these:

- **State what the tool does NOT do.** For `generate_policy`, the description explicitly says "the compiled policy is NOT applied." Without that line, an LLM will happily assume "compile and apply are the same thing" and the operator will get burned. Explicit non-behavior is as important as explicit behavior.
- **Show the expected input format in the description, not just the schema.** Zod-to-JSON-schema gives the model a shape, but a one-line example ("`intent: OWNER can do anything, MEMBER can only GET /vaults, default deny`") gives it a *style*. The output quality goes up noticeably when the model has a template to imitate.

---

## Auth: dual-mode (and the design gap that forced it)

First try was service-account-only. The idea was clean: machine credentials scoped to a single tenant, drop three env vars into Claude Desktop, done. Then I ran the first live smoke and two of the five tools returned **403 "Insufficient role"**.

Root cause: service accounts have role `API_CLIENT` by design. Admin endpoints (`/tenants/:id/memberships`, `/tenants/:id/client-apps`, `/tenants/:id/access-review/run`) require `OWNER` or `ADMIN`. My tool set mixed both audiences — some read-only stuff a service account can do, some admin stuff a service account explicitly *shouldn't* do.

Two clean fixes: escalate the service account's role (bad — breaks least privilege), or add a second auth path. Went with the second:

```typescript
export type SytadelConfig = {
  authApiUrl: string;
  ztApiUrl: string;
  tenantSlug: string;
  auth:
    | { mode: 'user'; email: string; password: string }
    | {
        mode: 'sa';
        clientAppId: string;
        serviceAccountId: string;
        serviceAccountSecret: string;
      };
  requestTimeoutMs: number;
};
```

The config detects which credentials are set. `SYTADEL_USER_EMAIL + SYTADEL_USER_PASSWORD` → user mode (full role scope, admin tools work). `SYTADEL_CLIENT_APP_ID + SYTADEL_SERVICE_ACCOUNT_ID + SYTADEL_SERVICE_ACCOUNT_SECRET` → SA mode (restricted, admin tools return 403). If both are set, user wins on the assumption that the operator meant the more capable one.

**The lesson worth writing down:** the auth model for an MCP server is coupled to the *audience* of the tools it exposes. A read-only "chat with your data" MCP fits service accounts perfectly. Anything that lets the LLM invoke admin operations needs credentials that can actually invoke them. Sneak an admin tool into an SA-only server and you're going to eat 403s until someone reads the code.

Token caching is a 30-line concern (behaves the same in both modes):

```typescript
private async getToken(): Promise<string> {
  const now = Date.now();
  if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
    return this.tokenCache.accessToken;
  }
  // Coalesce concurrent auth calls — MCP tools can fire in parallel.
  if (!this.inflightAuth) {
    this.inflightAuth = this.issueToken().finally(() => {
      this.inflightAuth = null;
    });
  }
  const fresh = await this.inflightAuth;
  return fresh.accessToken;
}
```

Two details worth calling out:

- **60-second early refresh.** Cached tokens count as expired 60s before their actual expiry, so a tool call in flight when the token expires can't race with the refresh. Small safety margin, zero cost.
- **`inflightAuth` promise coalescing.** MCP servers routinely see parallel tool calls (Claude will fire `list_users` and `list_service_accounts` in the same turn). Without coalescing, two calls hitting an expired token would each trigger a separate handshake. With it, they wait on the same promise.

The whole client, including error handling, is one file at ~150 lines. No third-party HTTP library — `fetch` is native since Node 18, and `AbortController` handles the timeout. MCP servers should be dependency-light; every dep added is a dep the operator has to trust when they wire it into Claude Desktop.

---

## Transport: stdio (with SSE as a follow-up)

```typescript
async function main(): Promise<void> {
  const config = loadConfig();
  const client = new SytadelClient(config);
  const server = buildServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
```

Stdio is the transport Claude Desktop and Cursor speak natively — the client spawns the server as a subprocess and pipes JSON-RPC over stdin/stdout. This is why the server needs to write **all its logs to stderr**: stdout is JSON-RPC framing, and any stray `console.log` corrupts the protocol.

```typescript
// Log to stderr — MCP owns stdout for the JSON-RPC framing.
function log(...args: unknown[]): void {
  console.error('[sytadel-mcp]', ...args);
}
```

I hit this exactly once, on the first run: a `console.log` in the config loader printed the tenant slug to stdout during boot. Claude Desktop showed a cryptic "invalid JSON-RPC" error and refused to complete the handshake. Ten seconds to fix, worth mentioning because every MCP server tutorial forgets to spell it out.

---

## Connecting from Claude Desktop

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "sytadel": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "SYTADEL_AUTH_API_URL": "http://localhost:3002/api",
        "SYTADEL_ZT_API_URL": "http://localhost:3010",
        "SYTADEL_TENANT_SLUG": "sentinel-labs",
        "SYTADEL_USER_EMAIL": "you@example.com",
        "SYTADEL_USER_PASSWORD": "your-password"
      }
    }
  }
}
```

(Swap `SYTADEL_USER_*` for the `SYTADEL_CLIENT_APP_ID / SERVICE_ACCOUNT_ID / SERVICE_ACCOUNT_SECRET` trio if you want SA scope instead.)

Restart Claude Desktop. The 5 tools appear in the tool picker. Anything the model does through them hits real Sytadel endpoints with a real (short-lived) JWT.

The same shape works in Cursor's MCP settings and in any MCP-aware client — the config file location changes, the JSON doesn't.

---

## Real-world usage

The interesting thing about MCP tools is what happens when you *don't* prompt the model. Once the tools are registered, a natural-language question like "which service accounts should we clean up this quarter?" makes the model:

1. Call `list_service_accounts` on its own initiative.
2. Look at `daysSinceLastUse` for each.
3. Call `query_session_anomalies` to check whether any dormant SA had suspicious activity.
4. Compose a prose recommendation — grounded in tool outputs.

You don't need to tell Claude "please use `list_service_accounts`." The description on the tool is enough. And because every tool response goes back through Claude, the model sees exactly what the operator would see if they curled the endpoint themselves.

The workflow that turned out surprisingly useful: **use `run_access_review` from Claude Desktop instead of the REST endpoint.** Same underlying call, but the operator can immediately ask follow-up questions ("why is that SA in the critical list? how many days idle?") and Claude has both the report and the raw snapshot in its context. Beats bouncing between a Grafana panel and a shell.

---

## The gotchas I hit

**Stdout pollution kills the handshake.** Covered above. `console.log → console.error` for everything.

**Zod schemas need the `.strict()` flag if you don't want extra keys accepted.** Default Zod object schemas are open. For tool inputs coming from an LLM, always `.strict()` — otherwise a hallucinated extra param sails through and confuses the tool implementation.

**`zod-to-json-schema` with `target: 'openApi3'` matters.** The MCP SDK expects the input schema in a specific dialect. The default Zod output (`draft-2020-12`) is JSON Schema, but MCP clients validate against OpenAPI-flavored JSON Schema. Wrong dialect → tools appear in the picker but silently fail on invocation.

**Default timeouts are the wrong shape when tools call an LLM.** My first pass had a 15s per-request timeout on the Sytadel HTTP client. `list_users` and `list_service_accounts` completed in tens of milliseconds. `run_access_review` didn't — it triggers a full Claude call on the backend, which reliably takes 8–20s. First live smoke: five tools tried, four fast ones OK, `run_access_review` timed out at 15s exactly. Bumped default to 60s and it landed in ~18s with an 8-recommendation payload. If your MCP server proxies through any endpoint that itself calls an LLM, the local client timeout has to be the sum of both, not the sum of the fast paths.

**`/auth/me` for tenant discovery breaks with service accounts.** The `list_tenant_users` tool originally called `/auth/me` to fetch the caller's tenant id, then hit `/tenants/:id/memberships`. Under service-account auth this returned 404 because the JWT `sub` isn't a User row. Fix: decode the JWT locally (no signature verify — the backend verifies on every call), pull `tenantId` out of the payload. Zero extra deps, works for both auth modes.

**The MCP SDK is verb-heavy.** `server.setRequestHandler(ListToolsRequestSchema, ...)` and `server.setRequestHandler(CallToolRequestSchema, ...)` is more boilerplate than most SDKs need. Wrapping the whole thing in one `buildServer(client): Server` function is worth the extra file — it makes the transport swap (stdio ↔ SSE ↔ tests) a one-line change.

---

## What this doesn't cover (and shouldn't yet)

- **Multi-tenant MCP.** This design pins one MCP server = one tenant. For a SaaS product wanting to ship an MCP server to end customers, each customer would have their own service account and their own local config. A hosted "one MCP server for all customers" version needs per-request auth — that's OAuth territory and a much bigger scope.
- **Write actions with side effects.** `run_access_review` is the closest thing to a write, and it's async (the review row is persisted, but the "action" is just an LLM call to Anthropic). Actions like `revoke_membership` or `disable_service_account` deliberately don't exist in this MCP surface yet. When they do, they'll gate behind an explicit user confirmation (HITL) — Claude proposes, human clicks a checkbox in a dashboard, automation acts. That's the next slice of this roadmap.
- **Server-Sent Events transport.** MCP supports it; this build doesn't wire it. Adding it is ~30 lines, but no MCP client I use daily consumes SSE — everything is stdio. If that changes, the wire-in point is `main()` in `src/index.ts`, and the server code doesn't need to know.

---

## Trade-offs vs "just use the REST API"

**When MCP wins:**
- Operators who live in Claude Desktop / Cursor and don't want to context-switch.
- Analysis tasks that combine 2–5 endpoints and would otherwise need a script.
- Onboarding: a new engineer with `SYTADEL_*` env vars can ask questions in English immediately, instead of learning your REST shape.

**When REST wins:**
- Automations, CI/CD, scripts. MCP is not a good pipeline primitive — it's an interactive one.
- Third-party integrations that speak REST natively. MCP is Claude's world; a Zapier or n8n integration should hit the REST endpoints directly.
- Anything with a strict latency SLO. Adding an LLM round-trip to every action inflates p95 by a lot.

The pattern to lean into: **REST is the source of truth, MCP is a lens over it.** Every MCP tool must be reproducible via `curl` against an existing endpoint. That constraint keeps the MCP layer honest, and it means switching operators (person A on the terminal, person B on Claude Desktop) doesn't change what the audit trail looks like.

---

## Live smoke — what the handshake actually looks like

The final round of the smoke against the running docker stack, with user-mode credentials for `sentinel-labs`:

```
[id=1] initialize OK
[id=2] list_tenant_users        OK — memberships JSON with role, active flag, last login
[id=3] list_service_accounts    OK — 6 client apps + nested service accounts
[id=4] query_session_anomalies  OK — recent flagged logins for the caller
[id=5] generate_policy          OK — PolicySet JSON for "MEMBER can only GET /vaults. Default deny."
[id=6] run_access_review        OK — 10.4 KB report, 8 recommendations, ~18s
```

All five tools reachable end-to-end, from the JSON-RPC frame to the real Postgres row (for the reads) and to the real Claude API (for policy compile and access review). No mocks, no fakes — the smoke run above hit the same code path that Claude Desktop would.

---

## Source

- MCP server: [`mcp-server/src/index.ts`](https://github.com/ElwinErnst/sentinel-suite/blob/main/mcp-server/src/index.ts)
- Tools: [`mcp-server/src/tools.ts`](https://github.com/ElwinErnst/sentinel-suite/blob/main/mcp-server/src/tools.ts)
- Sytadel HTTP client (auth + token cache): [`mcp-server/src/sytadel-client.ts`](https://github.com/ElwinErnst/sentinel-suite/blob/main/mcp-server/src/sytadel-client.ts)
- Server wiring: [`mcp-server/src/server.ts`](https://github.com/ElwinErnst/sentinel-suite/blob/main/mcp-server/src/server.ts)
- Full runnable stack: [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite)

Follow-up post will wire the HITL approval loop mentioned above: Claude proposes an action, an operator confirms it in the console UI, an automation actually runs it. Same tool surface, real closed loop, real trail in the audit chain.

If you spot a tool that would be useful for an operator's daily workflow, or hit a gotcha with your own MCP server, drop it in the [repo issues](https://github.com/ElwinErnst/sentinel-suite/issues).
