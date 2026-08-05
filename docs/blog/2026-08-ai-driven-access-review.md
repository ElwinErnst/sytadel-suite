# AI-driven access review — running a real one against a real tenant

Access reviews are the compliance ritual nobody wants to do. Every quarter (or year, or never), somebody exports a list of users, opens a spreadsheet, and starts asking "is this person still with us? does this service account still need write access?" Most of the answers are "probably", and 90% of the effort goes into re-reading the same rows that haven't changed since the last review.

The pieces that make this *un-fun* — enumerating users, cross-referencing service accounts, spotting the passkey vs password-only split, correlating with recent anomaly events — are exactly the pieces an LLM does well. Not decide who to fire. Not decide who to lock out. But **pre-read the surface, surface the highest-signal findings, and produce a machine-readable list of proposed actions** that a human then walks through in ten minutes instead of two hours.

This post walks through a small, production-shaped access review pipeline running against a NestJS auth service — daily cron, POST /run for on-demand, Claude Sonnet 5 for the analysis, structured JSON output so the recommendations plug straight into a dashboard or a ticketing bot. Plus the eval numbers I captured on a 5-fixture set:

- **5/5 fixtures passed**, **8/8 semantic expectations passed** (100%)
- **0 generation errors** — Claude never emitted an off-schema response
- **$0.015 per review**, latency p50 8.6s / p95 11.6s
- **1 real bug in the prompt design caught on the first live smoke** (structured output was empty even when the narrative report was full)

Full code: [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api), module `access-review`.

---

## The design

Three surfaces:

- **`POST /tenants/:tenantId/access-review/run`** — on-demand, gated to OWNER/ADMIN. Returns the review id + latency + recommendation count.
- **`GET /tenants/:tenantId/access-review/latest`** — dashboard-ready shape: report markdown, machine-readable recommendations, cost/latency metadata.
- **`GET /tenants/:tenantId/access-review/history?limit=N`** — timeline.

Backed by a daily cron (default `15 3 * * *` UTC) that walks active tenants and runs the same code path with `trigger: 'scheduled'`. The trigger label is persisted so you can tell "the operator forced this at noon" from "this was the 03:15 cron."

Behind the endpoints, a two-service split that turns out to be really useful for tests:

```
┌──────────────────────────────────────────────────────────────────┐
│ AccessReviewSnapshotService  (pure DB reads, no LLM, no I/O out)│
│                                                                  │
│   collect(tenantId) → TenantAccessSnapshot                       │
│     { users[], serviceAccounts[], recentAnomalies[], aggregates }│
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ AccessReviewService                                              │
│                                                                  │
│   run(input) →                                                   │
│     1. snapshot = snapshotService.collect()                      │
│     2. persist row (status: 'pending', snapshot json)            │
│     3. call Claude with structured output                        │
│     4. update row (status: 'succeeded', report_md, recs,         │
│                    cost, latency, tokens)                        │
└──────────────────────────────────────────────────────────────────┘
```

The **snapshot service** knows about the DB and nothing about LLMs. The **review service** knows about LLMs and nothing about DB queries (it holds a repository, but only to persist the review row itself). Neither one holds business logic that couples them — the snapshot shape is a plain type both agree on, no shared classes. That lets me pass hand-crafted fixtures straight to a bypass version of the review service in evals without a database at all.

---

## What goes in the snapshot (and what stays out)

The snapshot is the whole trust surface, condensed to what the LLM actually needs to reason:

```typescript
export type TenantAccessSnapshot = {
  tenantId: string;
  generatedAt: string;
  windowDays: number;
  users: Array<{
    userId: string;
    email: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    isActive: boolean;
    passkeys: number;         // count, not the actual credentials
    lastLoginAt: string | null;
  }>;
  serviceAccounts: Array<{
    serviceAccountId: string;
    clientAppSlug: string;
    name: string;
    isActive: boolean;
    lastUsedAt: string | null;
    daysSinceLastUse: number | null;
    hasAutoRotation: boolean;
    failedAuthAttempts: number;
  }>;
  recentAnomalies: Array<{
    severity: 'info' | 'warning' | 'critical';
    flags: string[];
    country: string | null;
    createdAt: string;
    loginKind: 'password' | 'passkey';
  }>;
  aggregates: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersWithoutPasskey: number;
    dormantServiceAccounts: number;
    criticalAnomaliesLastWindow: number;
  };
};
```

Deliberate exclusions:

- **No secret material.** No password hashes, no refresh tokens, no passkey credential IDs. If a snapshot ever leaks into a log, the blast radius is emails and metadata — never authentication material.
- **No individual anomaly IDs.** The LLM gets the aggregate + a bounded 20-item recent slice, not the whole 90-day list. Structured output tokens are expensive; sending a firehose of raw events makes the model chase noise.
- **`daysSinceLastUse` precomputed.** Small thing, but the model shouldn't have to compare timestamps. Give it the number, it uses it directly.
- **`aggregates` computed too.** Same reason. "5 users, 2 without a passkey" is more useful than "here are 5 users with a `passkeys` field each — go count." Every derived signal you can precompute saves the model reasoning tokens and makes the output more deterministic.

---

## The prompt (the second version, after the smoke bug)

First version was fine on paper, produced a *great* markdown report — and empty `recommendations` for the same tenant, in the same run. The narrative said "this OWNER account has no passkey and the last week had a critical anomaly", but the structured output was `[]`. The model treated the two outputs as alternatives instead of a mandatory pair.

Adding a **"CRITICAL OUTPUT CONTRACT"** section to the prompt fixed it on the next run — same tenant, same snapshot, 7 recommendations that map 1:1 to the narrative:

```
CRITICAL OUTPUT CONTRACT:
- Every specific concern you raise in "report_md" that maps to a concrete action MUST also appear as an entry in "recommendations". The report is for humans; the recommendations array is what an operator dashboard, ticketing bot or automated job consumes to actually DO something.
- The typical shape is: 3-8 recommendations, each grounded in one bullet from the report. An empty recommendations array means "no action needed" — only emit it if the tenant truly has nothing to fix.
- Subjects should be specific: use "user:{userId}", "service_account:{serviceAccountId}" or "passkey:{passkeyId}" where possible, not vague labels like "all users".
```

Two things about that section I'd underline for anyone building similar pipelines:

**"The typical shape is 3-8"** — bounded expectations. Without this, models veer between "one bullet" and "twelve." A soft number range gives them a target.

**"An empty array means 'no action needed'"** — explicit permission to *not* emit findings when there aren't any. Without this, models will invent low-signal recs to fill the slot. Silence is a valid output.

The recommendation shape:

```typescript
type AccessReviewRecommendation = {
  subject: string;         // e.g. "user:925df4a7", "service_account:abc123"
  action:                   // enum: 7 verbs
    | 'revoke_membership'
    | 'downgrade_role'
    | 'disable_service_account'
    | 'rotate_service_account_secret'
    | 'delete_passkey'
    | 'require_password_reset'
    | 'review_manually';
  severity: 'info' | 'warning' | 'critical';
  reason: string;           // one-sentence justification grounded in the snapshot
};
```

Constrained action verbs matter more than the field types suggest. If the enum said "action: string" the model would generate every synonym for "remove" it could think of. The enum forces it to pick a specific verb an automation can act on.

---

## The one live smoke that mattered

Not the evals — a live run against the actual demo tenant, once the prompt fix was in:

```json
POST /tenants/{tenantId}/access-review/run
→ { reviewId, status: "succeeded", recommendationsCount: 7, latencyMs: 18661 }

GET /tenants/{tenantId}/access-review/latest
→ {
    "status": "succeeded",
    "model": "claude-sonnet-5",
    "latencyMs": 18661,
    "costUsd": "0.03335",
    "inputTokens": 3566,
    "outputTokens": 1510,
    "recommendations": [
      {
        "severity": "critical",
        "action": "require_password_reset",
        "subject": "user:925df4a7-ab30-4619-b2d5-7de62af7af6c",
        "reason": "OWNER account has zero passkeys and logged in most recently amid a window containing a critical new_country/new_ip anomaly on password logins."
      },
      {
        "severity": "critical",
        "action": "disable_service_account",
        "subject": "service_account:33648d23-1dd3-43e4-b939-c86bb418f4f0",
        "reason": "backend-qa is still marked active but has had no use in 124 days (daysSinceLastUse: 124)."
      },
      // ... 5 more, all with concrete subjects and specific reasons
    ],
    "reportMd": "## Risk Posture Summary\nSmall tenant (3 users, 8 service accounts) but with disproportionate risk concentration: **100% of users lack passkeys**, including the OWNER account, and **7 of 8 service accounts are dormant or effectively unused** ..."
  }
```

Everything Claude flagged was traceable back to the snapshot — the 124-day dormant service accounts are literally in the DB, the critical JP anomaly is a real row from a smoke test I did last week, the "OWNER without passkeys" reflects the actual passkey rollout state on this tenant. Zero invention.

---

## The eval framework (semantic, not string-match)

Access review outputs are prose + structured. String-matching the prose is meaningless; text can be right or wrong ten different ways. What matters is whether the **recommendations** contain the actions we'd expect for a given snapshot.

So each fixture is a synthetic snapshot + a list of **predicates over the emitted recommendations**. A fixture passes iff every predicate is true:

```typescript
export type AccessReviewFixture = {
  name: string;
  snapshot: TenantAccessSnapshot;
  expectations: Array<{
    description: string;
    check: (recs: AccessReviewRecommendation[]) => boolean;
  }>;
  maxRecommendations?: number;
};
```

Five fixtures across the shapes worth checking:

1. **Clean tenant**: two active users with passkeys, one healthy SA, zero anomalies. Expectation: no warning/critical recs. Prevents overproduction on quiet tenants.
2. **Dormant + active SA**: legit users, one SA at 180 days idle. Expectation: `disable_service_account` on that SA, severity ≥ warning.
3. **Privileged users with no passkeys**: OWNER + ADMIN, zero passkeys each. Expectation: `require_password_reset` or `review_manually` on the OWNER, severity ≥ warning.
4. **Critical anomaly + no passkey OWNER**: previous fixture + a fresh JP `new_country + new_ip` critical anomaly. Expectation: at least one **critical** recommendation, targeting the OWNER.
5. **SA with failed auth attempts**: healthy tenant otherwise, one SA at 4 failed auth attempts. Expectation: `rotate_service_account_secret` on that SA.

Run:

```bash
docker exec sentinel-suite-auth-api-1 \
  node dist/modules/access-review/evals/access-review.eval.js
```

Result on the current prompt:

```
- clean tenant, no findings ... OK (1/1, 0 recs, 6546ms)
- dormant + active service account ... OK (2/2, 1 recs, 6313ms)
- privileged users with no passkeys ... OK (2/2, 3 recs, 8821ms)
- critical anomaly + no passkey OWNER ... OK (2/2, 5 recs, 11572ms)
- SA with failed auth attempts ... OK (1/1, 2 recs, 8630ms)

=== Aggregate ===
fixtures passed:      5/5
expectations passed:  8/8
generation errors:    0
latency p50:          8630ms
latency p95:          11572ms
avg tokens:           in=1685 out=647
total cost:           $0.0738 (5 generations)
cost/review:          $0.01476
```

Clean tenant emitted **zero** recommendations. That's the fixture I was most nervous about, because the failure mode of an LLM given a benign snapshot is often "invent something to look useful." Explicit prompt permission to be silent worked as intended.

---

## What this costs to run in production

For a tenant with a snapshot the shape shown above (few users, ~10 SAs, some anomalies):

- **~$0.015 per review** at Claude Sonnet 5 pricing (\$3 / \$15 per 1M in/out tokens)
- Daily cron across N tenants = **N × $0.015 / day**
- For 1,000 tenants running daily → **~$15/day, ~$450/month**

That's cheaper than a single senior engineer-hour per month, and it produces a report that would take a security lead multiple hours to assemble by hand.

Latency doesn't matter for the daily job (it's a batch, run overnight). For the on-demand `POST /run`, ~15–20 seconds is fine as a foreground operation — the caller gets a "review started" acknowledgment immediately and polls `GET /latest`, or you turn the endpoint into "start a job, return an id."

---

## Where this doesn't work (yet)

**Multi-tenant batch cost.** At 100k+ tenants, `$0.015 × daily × active-tenant-count` starts to matter. Two mitigations: (a) prompt-cache the system prompt across calls (Anthropic supports it and it's especially effective here because 95% of my tokens are the fixed prompt + fixed schema), and (b) skip tenants whose snapshot hasn't materially changed since the last review — hash the snapshot, only re-run when the hash changes.

**No cross-tenant patterns.** If the same anomaly pattern hits ten tenants in the same hour, this design flags each one independently. A supra-tenant layer (SOC-style) would need a different scaffolding — a fleet-wide analyzer that consumes all recent snapshots at once.

**Automation gap.** The `action` verbs are what an automation *could* execute, but this pipeline doesn't execute them. Wiring `disable_service_account` to actually flip `isActive: false` closes the loop but adds real risk — a wrong LLM recommendation now causes real production impact. That's a HITL step (human confirms in a dashboard, then the automation acts) which is exactly the M3 territory of this project's roadmap.

---

## Source

- Review service (Claude call + persistence): [`access-review.service.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/access-review/access-review.service.ts)
- Snapshot collector (pure DB reads): [`access-review-snapshot.service.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/access-review/access-review-snapshot.service.ts)
- Controller: [`access-review.controller.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/access-review/access-review.controller.ts)
- Daily cron: [`access-review.cron.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/access-review/access-review.cron.ts)
- Entity: [`entities/tenant-access-review.entity.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/access-review/entities/tenant-access-review.entity.ts)
- Fixtures + eval harness: [`evals/`](https://github.com/ElwinErnst/auth-api/tree/main/src/modules/access-review/evals)
- Runnable stack: [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite)

Follow-up post will wire the HITL approval loop — recommendations show up in a dashboard, an operator ticks a checkbox, an automation runs the action. Same LLM output, real closed loop.

If you spot a snapshot field that would produce sharper recommendations, or a fixture that would trip the current prompt, drop it in the [repo issues](https://github.com/ElwinErnst/sentinel-suite/issues).
