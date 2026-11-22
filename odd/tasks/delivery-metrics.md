# Delivery Metrics

Objective: make AI-assisted delivery speed/rework/defects observable from the suite's real artifacts (git, GitHub, ODD docs), with trend over time.
Branch: `feat/delivery-metrics` (stacked on `docs/add-agents-md`).
Delivery strategy: ask-on-risk. Test runner: bash (shellcheck + script self-check); no app runtime.

## Specs

- **S1 — Derived metrics script.** A committed `scripts/metrics.sh` computes, from git + `gh`, without manual input:
  - Speed: PR lead time (created→merged) median & p90; PRs/week; commits/week.
  - Rework: revert commits; `fix(`-after-`feat(` in the same scope within a window; churn = files re-touched within 7 days; ODD forecast-vs-actual drift from `odd/tasks/*`.
  - Defects: `fix`/hotfix PRs ÷ total merged PRs; smoke-check failure rate on `main`.
  - Output: human table by default, `--json` for machine use. Proxies are labelled as proxies in the output.
  - Scope: meta-repo by default; `--submodules` iterates the 6 submodules.
- **S2 — ODD metrics block + docs.** Extend the ODD feature-doc convention with a machine-readable `## Metrics` block (`forecast_lines`, `actual_lines`, `rework_rounds`, `review_defects`, `verify`, `agent_route`) and document both the block and `scripts/metrics.sh` in `AGENTS.md`.
- **S3 — Trend in CI.** `.github/workflows/metrics.yml` runs `scripts/metrics.sh --json` on merge to `main` and appends a dated snapshot to a durable store.

## Constraints

- `main` is protected (`enforce_admins: true`, PR required, required check `smoke`, conversation resolution). **A GitHub Action cannot push to `main`.** The trend store is therefore an orphan `metrics` branch, not a commit on `main`. (Supersedes the original design's "history.jsonl on main with [skip ci]".)
- Honesty over vanity: fix-commit/revert are proxies for defects/rework and must be labelled as such.
- Do not touch or stage `sytadel-growth-os`.
- Read-only over history; the script never mutates the repo.

## Tasks

- [x] **DM-001 — metrics.sh** (S1). Route: inline. New file `scripts/metrics.sh`. Verified: `bash -n` OK; table + `--json` run against real history (172 commits/82 PRs over 1y, lead-time median 0.2h/p90 23.7h, fix ratio 9.8%, churn 2.3%); `jq` confirms valid JSON with all expected keys; git-only degrade path yields `prs:null` + `commit-proxy` defect source; `--submodules` reports all 6. Fixed two bugs found in verification (git-only `generated_from` and `prs:0`→`null`). Risk: none (read-only analysis script).
- [ ] **DM-002 — ODD block + AGENTS.md** (S2). Route: inline. Edit `AGENTS.md`; add template snippet. Risk: none (docs).
- [ ] **DM-003 — metrics.yml** (S3). Route: inline. New workflow pushing to orphan `metrics` branch. Risk: item 5 (CI/delivery) — own commit; verify workflow YAML and token scope.

## Log

- L1 (2026-11-22): user asked to tackle the metrics gap (speed/rework/defects) identified in the AI-maturity ladder assessment, to move from ladder level 3 (Delegated) toward 4 (Orchestrated). Chose option C: git/GitHub-derived script + structured ODD block + CI trend.
- L2 (2026-11-22): verified `main` branch protection (`enforce_admins: true`, PR required). The design's "commit history.jsonl to main via CI" is unachievable; switched S3 storage to an orphan `metrics` branch. Recorded as a constraint.
