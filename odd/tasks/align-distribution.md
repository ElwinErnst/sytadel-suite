# Feature: Align distribution (docs & pointers ↔ reality)

**Objective:** Make the suite's distribution surface (submodule pointers, READMEs,
roadmap/capability docs, landing demo copy) tell the truth about what actually
ships, as verified against git/code on 2026-10-24. Documentation-alignment only —
no new product features.

**Problem / why:** The 2026-10-19 status report flagged several doc↔reality
gaps. Verification confirmed them (plus found the MCP-demo gap is larger than
reported). Stale distribution misleads evaluators and contributors.

**Authorized scope:** docs, README, landing copy, and the GrowthOS submodule
pointer. NOT authorized: building new MCP tools, changing product behavior,
push/PR/merge (user-owned).

**Delivery strategy:** `ask-on-risk` (default). Docs-only, low risk, small
footprint — expected well under the ~400-line slice budget. Push/PR left to user.

**TDD:** N/A (docs/config only). Checks = build/lint where a touched repo has it
(web build for content.ts), link/anchor sanity, and `git diff` readback.

## Tasks

- [x] **T1 — Bump GrowthOS submodule pointer** (repo: sytadel-suite) — DONE
  - `314f386` → main `f56aae7` (verified: ancestor, moves forward, no loss).
  - Brings Slice 6 Account Research + ICP-fit scoring into the suite reference.
  - Route: inline. Commit `cff724f` on branch `docs/align-distribution`.

- [x] **T2 — Remove broken `docs/reports` links from meta README** (repo: sytadel-suite) — DONE
  - 3 refs (README.md:30, :203, :224) pointed to a `.gitignore`d path (line 54) →
    absent from repo → dead on GitHub. Removed the standalone paragraph (:30) and
    the list item (:224); dropped the inline dead link, kept the sentence (:203).
  - Route: inline. Commit `6256edd`.

- [x] **T3 — Fix landing demo copy overclaim** (repo: sytadel-suite / sytadel-web) — DONE
  - `content.ts` demo.description (es/en/pt) claimed the agent uses "the same tools
    the MCP server exposes". FALSE: 3 of ~6 scenarios (`query_audit_timeline`,
    `propose_agent_action`, `verify_document`) are real suite capabilities NOT
    exposed as MCP server tools (only 5 tools exist).
  - Fix applied: reframed to "operates across the Sytadel suite … combining MCP
    server tools with platform capabilities". All scenarios kept (capabilities real
    & shipped). Check: `npm run build` ✅ (es/en/pt/index built).
  - Route: inline. Commit `6256edd`.

- [x] **T4 — Align GrowthOS capability doc with real auth scopes** (repo: sytadel-growth-os) — DONE
  - `docs/integration/sytadel-capabilities.md` still said no `research:*`/`leads:*`
    even at main `f56aae7` (internal inconsistency — CLAUDE.md there was already
    current). Reality (auth-api `api-scopes.ts`): `research:read`, `research:fetch`,
    `leads:read` landed; `outreach:*`/`content:*` still absent; SA provisioning +
    runtime wiring still pending. Also updated the "Consequence" section (optional
    feature-flagged Sytadel identity now exists; local is the fallback).
  - Route: inline. Commit `5822ae0` on growth-os branch `docs/align-capabilities-scopes`.

- [x] **T5 — Billing README: cover platform + merchant billing** (repo: billing-api) — DONE
  - README described only tenant subscriptions; no merchant/platform/organization.
  - Delegated writer mapped the real surfaces (tenant/app subs, platform billing
    per org, merchant domain) with file:line evidence, and documented all three in
    neutral Spanish (matching house style — 5/6 submodule READMEs are Spanish).
    Added: "Tres superficies de facturación" table + "2. Suscripciones de plataforma
    (organización)" + "3. Merchant billing (dominio de reventa)" with real routes.
  - Verified: 1 commit, README.md only, +83/−26 vs main. Commit `004a628` on billing
    branch `docs/align-readme-platform-merchant`.
  - Route: DELEGATED writer. (Note: first pass was committed in English by my
    delegation-prompt error; corrected to Spanish via amend, branch kept to 1 commit.)

## Notes / evidence
- Verification saved in Engram: "Sytadel 2026-10-19 status report verified against git".
- Submodule tree-equality: auth/billing pointers are feature-branch tips but
  tree-identical to merged main — no drift there; only GrowthOS needed a bump.
- `docs/ROADMAP.md` has a pre-existing uncommitted local edit (AWS Bedrock item)
  unrelated to this feature; leave it untouched.

## Progress
- ALL TASKS DONE. Commits across 3 repos:
  - sytadel-suite (branch `docs/align-distribution`): `cff724f` (T1 pointer),
    `6256edd` (T2 README links + T3 demo copy), plus this tracking doc.
  - sytadel-growth-os (branch `docs/align-capabilities-scopes`): `5822ae0` (T4).
  - billing-api (branch `docs/align-readme-platform-merchant`): `004a628` (T5).
- Checks: sytadel-web `npm run build` ✅. Docs readback ✅ on all. No source/tests
  touched. Each submodule change is on its own branch for its own PR — the suite
  pointer deliberately stays at GrowthOS main `f56aae7` (not the unmerged T4 commit).
- Next step (user-owned): push each branch and open PRs; after the growth-os and
  billing PRs merge, a follow-up pointer bump picks up T4/T5.
