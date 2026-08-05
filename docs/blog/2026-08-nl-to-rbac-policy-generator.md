# LLM-as-compiler for RBAC policies — natural language in, JSON out, gateway enforces it

The way most teams write RBAC policies today is a slow accident: someone reads a Notion doc, someone else writes a JSON file, a third person opens a PR, and by the time review is done, the requirement in the doc doesn't quite match the JSON in the repo. A few iterations later, nobody knows which rule was for the audit and which one was Bob covering for something that broke last quarter.

The moment I saw Claude's structured outputs land, this was the first thing I wanted to try: **use the LLM as a compiler, not as a policy engine**. NL intent goes in, a validated JSON policy set comes out, my Zero Trust gateway enforces it. Zero LLM in the request path, zero cost per user request, deterministic behavior at runtime.

This post walks through the whole pipeline running in a NestJS + Postgres stack: prompt design, JSON schema wiring, the runtime evaluator, and — most importantly — the eval numbers I captured on 8 fixtures with 34 expectations. Full code: [ElwinErnst/zerotrust-api](https://github.com/ElwinErnst/zerotrust-api).

TL;DR of the eval run:

- **6/8 fixtures fully passed**, **30/34 expectations correct** (88.2%)
- **0 generation errors** — every policy Claude emitted was a schema-valid PolicySet
- **$0.008 per policy generation**, **latency p50 3.1s / p95 7.4s**
- **Uncovered a real bug in my own evaluator** — the eval framework earned its keep on the first run

---

## The design (why LLM-as-compiler, not LLM-as-engine)

Two very different architectures share the name "AI-powered policy":

**LLM in the request path.** Every gateway call sends the user, their roles, the requested resource, and the current context to an LLM which returns allow/deny. Latency: seconds. Cost: pennies per request. Non-determinism: guaranteed. Auditability: near zero.

**LLM as a compiler.** The LLM runs *once*, at policy-authoring time, converting natural-language intent into a validated JSON structure. The gateway then evaluates that structure at request time — deterministic, cheap, auditable. The LLM never sees a real request.

The compiler pattern is the one this post is about. It's boring in the best way. It has the properties operators need in the fast path (no LLM latency, no LLM cost, deterministic decisions) and the properties authors want when they write a rule (natural language input, immediate feedback with warnings, human-readable rule descriptions).

The full pipeline:

```
"OWNER can do anything on vault. MEMBER can only GET /vaults."
                       ↓
              POST /policies/generate
                       ↓
              Claude Sonnet 5 (structured output)
                       ↓
    { policy: PolicySet, warnings: [...], cost, latency, tokens }
                       ↓
              PUT /policies/:tenantId
                       ↓
              in-memory PolicyStore (per tenant)
                       ↓
              gateway request comes in
                       ↓
              PolicyService.decide() checks store first
                       ↓
              evaluatePolicySet(policy, input) — pure fn, O(rules)
                       ↓
              { allow: true } or { allow: false, reason: '...' }
```

---

## The schema (this is the actual contract)

The gateway can only enforce what it understands. So the schema is written twice — once in Zod for runtime validation, once in JSON Schema for Claude's structured output — and both live in the same file so a drift breaks the build:

```typescript
export const policyRuleSchema = z.object({
  description: z.string().min(1).max(200),
  effect: z.enum(['allow', 'deny']),
  when: z.object({
    upstream: z.enum(['vault', 'auth', 'billing']),
    methods: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])).nonempty().optional(),
    pathGlob: z.string().min(1).optional(),
  }).strict(),
  if: z.object({
    roleIn: z.array(z.string().min(1)).nonempty().optional(),
    actorTypeIn: z.array(z.enum(['user', 'service_account'])).nonempty().optional(),
  }).strict().optional(),
  reason: z.string().max(200).optional(),
}).strict();

export const policySetSchema = z.object({
  version: z.literal(1),
  rules: z.array(policyRuleSchema).max(50),
  default: z.enum(['allow', 'deny']),
}).strict();
```

Semantics kept intentionally boring: **rules are ordered, first match wins**, if no rule matches the `default` applies. That's it — no priority scoring, no rule composition, no "deny takes precedence over allow." Complex behavior is expressed by rule ordering, which is auditable in one glance.

---

## The prompt (short, opinionated, no roleplay)

```
You are a policy compiler for a Zero Trust API gateway.
Given a natural-language intent, emit a JSON policy set that the gateway can evaluate.

Semantics:
- Rules are evaluated top to bottom. The first rule whose "when" AND "if" match is the decision.
- If no rule matches, the policy set's "default" applies.
- "effect": "allow" grants the request; "effect": "deny" blocks it with an optional "reason".

Available upstreams: vault, auth, billing.
HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
Standard human roles: OWNER, ADMIN, MEMBER. You may also use domain roles like EDITOR, VIEWER,
etc. — they are opaque strings the caller's JWT will carry.

Rules of thumb:
- Prefer allow-listing over deny-listing: emit specific allow rules and a "default": "deny".
- Keep rule count small — collapse similar rules with method arrays and path globs.
- Each rule's "description" should be a short human phrase (imperative or descriptive), not the
  raw intent verbatim.
- If the intent is ambiguous (e.g. "editors write only their own docs" — the gateway cannot see
  ownership), add a WARNING in your response instead of inventing behavior. Emit the safest
  approximation you can and flag the gap.
- If the intent references an upstream you were not told about, emit a warning and use "vault"
  as a placeholder, not an invented upstream.
```

Two decisions in here that carry weight:

**The "prefer allow-listing + default deny" rule of thumb** means the LLM's default output is safe-by-default. If the compiler misunderstands your intent, the worst case is "too restrictive," never "silently permissive." A generated policy set that misses a rule denies too much, not too little.

**The warnings field.** The LLM knows the gateway can't see document ownership. If you write "editors can only edit their own docs," it emits a warning: "cannot enforce ownership at the gateway; approximated as allowing all edits by EDITOR role." You see the gap immediately instead of after a compliance auditor asks why unauthorized edits are logged.

---

## Structured output (three gotchas from the real integration)

Anthropic's `output_config` with a JSON schema is the whole reason this is viable. Without it you're chasing parse failures forever. But the validator has quirks the docs don't shout about:

**1. `additionalProperties: false` is required on every object level.**
Not on the top-level only — every nested object. The API returns a 400 with a helpful message pointing to the exact path, but you'll hit this on the first run.

**2. `maxItems` / `minItems` on arrays are NOT supported.**
```
output_config.format.schema: For 'array' type, property 'maxItems' is not supported
```
Enforce those bounds in your runtime validator (Zod handles them fine). Give the model a hint in the prompt ("keep rule count small") if you need soft guidance.

**3. `thinking: { type: 'disabled' }` is mandatory for classification-style tasks.**
Adaptive thinking eats your `max_tokens` budget for reasoning tokens, leaving nothing for the JSON output. You get truncated JSON back and your parser explodes. Explicitly disabling thinking on Sonnet+Opus calls where you don't need it is the difference between a working pipeline and a mysterious 30% failure rate.

The service call ends up being about 20 lines of glue:

```typescript
const response = await this.client.messages.create({
  model: this.config.model,
  max_tokens: this.config.maxTokens,
  thinking: { type: 'disabled' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: JSON.stringify({ intent: input.intent }, null, 2) }],
  output_config: {
    format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
  },
});

const raw = JSON.parse(response.content.find((b) => b.type === 'text')!.text);
const policy = policySetSchema.parse(raw.policy);  // second line of defense
```

The Zod parse at the end is the *second* line of defense. Even if Claude honors the JSON schema perfectly, our runtime types can diverge from the JSON schema. Parsing again with Zod against the same shape catches drift before it reaches the gateway.

---

## The evaluator (pure function, easily testable)

The evaluator is intentionally boring. Zero I/O, zero classes:

```typescript
export function evaluatePolicySet(
  policySet: PolicySet,
  input: PolicyInput,
): PolicyDecision {
  for (const rule of policySet.rules) {
    if (ruleMatches(rule, input)) {
      if (rule.effect === 'allow') return { allow: true };
      return { allow: false, reason: rule.reason ?? `Denied by rule: ${rule.description}` };
    }
  }
  if (policySet.default === 'allow') return { allow: true };
  return { allow: false, reason: 'No rule matched (default deny)' };
}

function ruleMatches(rule: PolicyRule, input: PolicyInput): boolean {
  const w = rule.when;
  if (w.upstream !== input.upstream) return false;
  if (w.methods?.length && !w.methods.includes(input.method.toUpperCase() as never)) return false;
  if (w.pathGlob && !globMatches(w.pathGlob, input.path)) return false;

  if (rule.if?.roleIn?.length) {
    if (!rule.if.roleIn.some((r) => input.roles.includes(r))) return false;
  }
  return true;
}
```

That's 20 lines that decide every gateway request. Pure functions ship with a lot of confidence: unit-testable without mocks, easily replayable against historical requests, and easy to reason about when reading a decision from the logs.

The glob matcher (not shown) supports `*` (matches within a path segment) and `**` (matches across segments), plus escapes for regex metacharacters. Twenty more lines.

---

## Wiring it into the gateway

The trick to shipping a new engine without breaking existing behavior: **prefer the new engine, fall back to legacy**. `PolicyService.decide()` becomes:

```typescript
async decide(input: PolicyInput): Promise<PolicyDecision> {
  // Layer 1: if this tenant has a compiled PolicySet loaded, evaluate it.
  const stored = this.policyStore.get(input.tenantId);
  if (stored) {
    return evaluatePolicySet(stored.policySet, input);
  }

  // Layer 2: legacy hardcoded logic (existing behavior).
  const entitlements = await this.authDirectory.getTenantEntitlements(input.tenantId);
  // ... unchanged existing rules ...
}
```

Tenants without a compiled policy set get the same behavior they had yesterday. The moment a tenant PUTs a policy set, the gateway starts enforcing it. Rollback is a single `DELETE /policies/:tenantId`.

The in-memory `PolicyStoreService` is a `Map<tenantId, PolicySet>`. Yes, it loses state on restart. That's *fine* for a demo and for the initial deployment — persistence belongs in `auth-api` as a per-tenant column, and that's the next slice. Reading it from `auth-api` via the existing `AuthDirectoryService` on gateway boot gives you crash recovery without introducing a database dependency into the ZT service.

---

## The smoke that convinced me it was real

Not from the evals — this one is by hand, against the running docker stack, to prove the compiled policy actually reaches the gateway:

```
1. POST /policies/generate  { intent: "OWNER can do anything, MEMBER can only GET /vaults, default deny" }
   → 3 rules generated, cost $0.008

2. PUT /policies/{tenantId}                                       → 200

3. GET /vault/vaults  (as OWNER)                                  → 200  ✓ rule 1 allow

4. POST /vault/vaults (as OWNER)                                  → 201  ✓ rule 1 allow

5. PUT /policies/{tenantId} { rules: [], default: "deny" }        → 200

6. GET /vault/vaults  (as OWNER, same token)
   → 403 { "message": "No rule matched (default deny)" }          ✓ engine live

7. DELETE /policies/{tenantId}                                    → 204

8. GET /vault/vaults  (as OWNER)                                  → 200  ✓ fallback to legacy
```

Step 6 is the sale: **same OWNER, same token, different policy**. The gateway swapped enforcement on the fly without a redeploy.

---

## The eval results

Ran the 8-fixture semantic eval (each fixture has 3–6 expectations — a fixture only passes if *every* expectation matches). Fixtures cover: standard allow/deny, method arrays, path globs, deny-by-default, explicit deny rules, and actor-type distinctions.

**Aggregate:**

| Metric                | Value            |
|-----------------------|------------------|
| Fixtures passed       | **6/8** (75%)    |
| Expectations passed   | **30/34** (88.2%) |
| Generation errors     | 0                |
| Avg warnings/fixture  | 0.5              |
| Latency p50           | 3,141 ms         |
| Latency p95           | 7,365 ms         |
| Avg tokens            | in=1,586 out=210 |
| Total cost (8 gens)   | $0.0632          |
| **Cost per generation** | **$0.00790**   |

Zero generation errors means the LLM never emitted a policy set that failed Zod validation. Structured output is doing its job.

---

## The two failures (worth publishing verbatim)

**Fixture: "admin can manage documents, member read only"** — 2/4 expectations failed.

The intent said "MEMBER can read documents." The LLM emitted a rule with `pathGlob: '/documents/*'` (matches subpaths like `/documents/42`). The eval expectation tested `path: '/documents'` (exact path, no trailing segment). The evaluator correctly saw no match and returned `default: deny`.

This is an **ambiguity in the intent**, and honestly the LLM made the more defensible call: "read documents" almost always means the individual document endpoints, not the list. Fix on the fixture side (add `/*` to the expectation), or the intent side (be explicit: "MEMBER can read the /documents list and individual documents").

**Fixture: "service accounts blocked, users allowed"** — 2/3 expectations failed.

The intent: "OWNER and ADMIN humans can access vault. Service accounts denied." The LLM correctly emitted `{ effect: 'deny', if: { actorTypeIn: ['service_account'] } }` as the first rule. Expected behavior: an OWNER user should skip that rule (they're not a service account) and match the allow rule below it.

Actual behavior: the deny-first-service-accounts rule matched *every* input, including the OWNER user. My evaluator ignored `actorTypeIn` — the schema declares it, but the runtime matcher only checks `roleIn`. Every input trivially passes the missing check.

**This is a real bug I shipped**, uncovered by the first eval run. It's exactly why evals matter more than the classifier: without them I'd have shipped a policy set that blocks OWNER users by accident. The fix is 3 lines in the matcher — waiting for a follow-up commit that also adds an `actorType` field to the `PolicyInput` (right now `roles` carries it implicitly for JWTs). The eval framework will re-run and confirm.

Publishing this here on purpose. The point of evals isn't to look impressive on day one — it's to catch what you missed *while* you're still able to fix it cheaply.

---

## When to reach for this pattern

**Use it when:**
- You have non-trivial RBAC policies that change often enough that the config PR loop is painful.
- Your operators aren't full-time policy engineers but need to write policy.
- The gateway can express the semantics you need (roles + methods + paths). If your policies need ownership, temporal windows, or approval chains, this isn't your primitive.

**Don't use it when:**
- You need a policy language that supports composition and precedence beyond ordered rules (Rego / OPA lives here).
- Your policy input includes rich context (user attributes from an IDP, resource attributes from a resource server). A generator that never sees those attributes will produce brittle rules.

The really useful thing about the "LLM as compiler" pattern is that it's *composable* with a proper policy engine. You can generate OPA Rego with the same technique — swap the schema, swap the evaluator, keep the compiler.

---

## Source

- Generator service: [`src/modules/policy-generator/policy-generator.service.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy-generator/policy-generator.service.ts)
- JSON + Zod schema: [`schema/policy.schema.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy-generator/schema/policy.schema.ts)
- Pure evaluator: [`src/modules/policy/policy-evaluator.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy/policy-evaluator.ts)
- Store + endpoints: [`policy-store.service.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy/policy-store.service.ts) + [`policy-store.controller.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy/policy-store.controller.ts)
- Fixture dataset: [`evals/fixtures.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy-generator/evals/fixtures.ts)
- Eval harness: [`evals/policy-generator.eval.ts`](https://github.com/ElwinErnst/zerotrust-api/blob/main/src/modules/policy-generator/evals/policy-generator.eval.ts)
- Full stack runnable locally: [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite)

Follow-up post will fix the `actorType` gap, re-run the eval, and show the "before vs after" diff — plus start plumbing per-tenant persistence into `auth-api`. If you spot another gap in the eval fixtures or the evaluator, drop it in the [repo issues](https://github.com/ElwinErnst/sentinel-suite/issues).
