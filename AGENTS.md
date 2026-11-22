# AGENTS.md

Operating context for AI coding agents (and humans pairing with them) working in
the **Sytadel Suite**. The goal of this file is simple: a fresh clone should
carry the rules of engagement with it, so an agent or a new contributor can
reproduce how work is actually done here without reconstructing it from tribal
knowledge.

This file is repo-specific. It documents *how this codebase is built and
verified*, not a generic agent persona.

---

## 1. What this repository is

`sentinel-suite` is a **meta-repository**: a thin root that composes several
independently deployable services as git submodules. The root owns
orchestration (Docker Compose, smoke tests, suite-wide docs); each submodule
owns its own code, tests, and CI.

| Path | Repo | Stack | Role |
| --- | --- | --- | --- |
| `auth/auth-api` | `auth-api` | NestJS + TypeORM | Identity, tenancy, authorization source of truth |
| `ZeroTrust/zerotrust-api` | `zerotrust-api` | NestJS + TypeORM | Policy evaluation, Zero Trust decisions |
| `securechain-vault` | `securechain-vault` | NestJS | Secrets + tamper-evident audit/notary |
| `billing/billing-api` | `billing-api` | NestJS + TypeORM | Billing, entitlements, provider webhooks |
| `sytadel-growth-os` | `sytadel-growth-os` | NestJS CLI | Growth AI "customer zero" (dogfooding) |
| `mcp-server` | `sytadel-mcp-server` | Node + MCP SDK | MCP server exposing Sytadel primitives as tools |
| `sytadel-app` | — | Next.js | Admin console / control-plane UI |
| `sytadel-web` | — | Astro | Marketing + interactive MCP demo |

Submodule pointers (gitlinks) are bumped from the root via `chore: bump …`
commits once the submodule's own PR is merged.

> **Submodule sync gotcha:** never `git reset --hard` the root to sync
> submodules — it discards uncommitted work inside them. Use
> `git submodule update --checkout` then `merge --ff-only`.

---

## 2. How we work: Organic Driven Development (ODD)

Non-trivial, multi-session, or multi-deliverable work is tracked with a **feature
document** under `odd/tasks/<feature-name>.md`. These documents are the
specification agents read by reference; they are committed, versioned, and are
the single source of truth for a feature's intent and progress.

A feature document follows a fixed order:

- **Header** — objective, branch, delivery strategy, test runner.
- **`## Specs`** — numbered `S#` requirements with authorized scope and
  acceptance criteria. User's exact strings/examples are quoted verbatim, never
  summarized, and no requirement is added that the user did not ask for.
- **`## Tasks`** — one line per task: stable ID, linked `S#`, route
  (inline/delegated), status, and the commit that holds it.
- **`## Log`** — the logbook. `L1` is the original request verbatim; later
  corrections, rationale, and verification evidence are appended.

See `odd/tasks/saas-control-plane.md` for a worked example (specs `SCP-001`..
`SCP-006`, per-task acceptance + verification + commit SHAs).

Small, understood, low-risk changes do **not** need a feature document — work
inline and keep it proportionate.

### Working rules

- **Spec first, then tests, then code.** When a runnable test and a clear
  expected outcome exist, observe RED before implementing, then GREEN.
- **Conventional Commits** only (`feat`, `fix`, `docs`, `chore`, `test`,
  `style`, `refactor`), scoped where useful (`feat(app)`, `docs(odd)`).
- **No AI attribution** in commit messages (no `Co-Authored-By` / "Generated
  by" trailers).
- **Reviewable slices.** Keep work units around ~400 authored changed lines
  where reasonable; split oversized changes into chained PRs. This is a planning
  heuristic, not a hard gate — do not omit tests or compress docs to hit it.
- Keep tests and docs in the **same commit** as the behavior they cover.

---

## 3. Per-repository commands

Use the **package manager the repo's CI uses** — it is authoritative.

| Repo | PM | Test | Build | Lint |
| --- | --- | --- | --- | --- |
| `auth/auth-api` | **yarn** | `yarn test` | `yarn build` | `yarn lint` |
| `ZeroTrust/zerotrust-api` | **yarn** | `yarn test` | `yarn build` | `yarn lint` |
| `billing/billing-api` | **yarn** | `yarn test` | `yarn build` | `yarn lint` |
| `sytadel-growth-os` | **npm** | `npm test` | `npm run build` | `npm run lint` |
| `mcp-server` | **npm** | `npm test` | `npm run build` | `npm run typecheck` |
| `sytadel-app` | **npm** | `npm test` | `npm run build` | `npm run lint` |
| `sytadel-web` | **npm** | `npm test` | `npm run build` | — |
| `securechain-vault` | — | see repo CI | — | — |

> **Never run `npm install` in a yarn repo** (`auth-api`, `billing-api`,
> `zerotrust-api`). It drifts the lockfile and breaks CI. `auth-api` has a stray
> `package-lock.json`; ignore it — CI uses `yarn install --frozen-lockfile`.

### Database migrations

TypeORM services run migrations, never `DB_SYNC`. To apply:
`migration:run` (e.g. `yarn migration:run` / `npm run migration:run`). Do not
re-enable schema sync in any environment.

---

## 4. Verification & CI gates

Every repo in the suite has CI (`.github/workflows/`):

- **Submodules** — each has `ci.yml` running **build + test** (and typecheck in
  `mcp-server`) on PR and push to `main`.
- **Root** — `.github/workflows/smoke.yml` brings the full stack up with
  `docker compose up -d --build`, waits until `auth-api` accepts a login, then
  runs `scripts/smoke.sh` end-to-end.

Before claiming work is done, run the affected repo's `test` and `build`, and —
for runtime-affecting changes — drive the actual flow (not just unit tests).
Record failed, skipped, or N/A checks honestly in the feature document's `Log`.

---

## 5. Delivery & branch policy

- **`main` is protected on every public repo — PR only.** Never push directly to
  `main`. Branch, commit in reviewable slices, open a PR.
- The root additionally requires the smoke check before merge.
- Push, PR creation, and merge are **human decisions** — an agent prepares the
  branch and commits; it does not push or merge without being asked.
- Templates live in `.github/PULL_REQUEST_TEMPLATE.md` and
  `.github/ISSUE_TEMPLATE/`.

---

## 6. The MCP server

`mcp-server` (`@sytadel/mcp-server`) exposes Sytadel identity/access primitives
as MCP tools for Claude Desktop, Cursor, and any MCP client. Its central
security guarantee is enforced by tests in `mcp-server/src/tools.test.ts`: **no
tool accepts a tenant/target identifier** — the tenant is always derived from
the authenticated principal, so an adversarial model cannot act cross-tenant.
Preserve that invariant; the tests run in CI.

---

## 7. Skills registry (optional tooling)

`.atl/skill-registry.md` indexes agent "skills" available on the local machine.
It is **gitignored** (local, per-developer) and is not required to work in this
repo — it is a convenience index for agents that support it. Do not depend on it
being present.

---

## 8. Security posture (non-negotiables)

This is a security product; treat these as invariants, not preferences:

- **Tenant isolation.** Authorization is derived from the authenticated
  principal. Never accept a caller-supplied tenant/target id to widen scope.
- **No secrets in the repo.** Compose files interpolate `${VAR}` with insecure
  dev fallbacks only; production secrets come from the environment. `.env*` is
  gitignored.
- **Merchant/provider billing fails closed** — no silent fallback to global
  credentials for merchant-scoped operations.
- **Audit chain is tamper-evident.** Do not weaken signing/anchoring without an
  explicit, reviewed decision.

When a change touches auth, permissions, secrets, migrations, published
contracts, or provider/webhook handling, treat it as high-risk: add regression
tests and get an independent review before merge.

---

## 9. License

The suite is **source-available under PolyForm Strict 1.0.0** (noncommercial,
all rights reserved). New files inherit this license; keep `LICENSE` headers and
notes consistent with the existing repos.
