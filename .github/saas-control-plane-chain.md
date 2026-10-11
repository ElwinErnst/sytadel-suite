# SaaS Control Plane — Root PR Chain

This tracker coordinates the root-repository integration for approved issue [#75](https://github.com/ElwinErnst/sytadel-suite/issues/75). It remains **draft/no-merge** until all nested Auth and Billing dependencies and the three root child PRs have been reviewed and integrated. Do not merge this tracker or any child PR as part of this work.

## Integration order

```text
Auth tracker #22 + Auth children #23–#26 ─┐
                                           ├─> 📍 Root tracker → services/gitlinks → UI/docs → resilience/policy
Billing tracker #24 + Billing children #25–#31 ┘
```

The Auth and Billing feature chains are independently tracked, but the root service-integration slice must point at the final reviewed PR-head commits from both chains:

| Service | Tracker / ordered child PRs | Final root gitlink target |
|---------|-----------------------------|---------------------------|
| Auth API | [#22](https://github.com/ElwinErnst/auth-api/pull/22), [#23](https://github.com/ElwinErnst/auth-api/pull/23), [#24](https://github.com/ElwinErnst/auth-api/pull/24), [#25](https://github.com/ElwinErnst/auth-api/pull/25), [#26](https://github.com/ElwinErnst/auth-api/pull/26) | #26 `586e2edb70cfa79ed58de105de38bbf5e2c1df50` |
| Billing API | [#24](https://github.com/ElwinErnst/billing-api/pull/24), [#25](https://github.com/ElwinErnst/billing-api/pull/25), [#26](https://github.com/ElwinErnst/billing-api/pull/26), [#27](https://github.com/ElwinErnst/billing-api/pull/27), [#28](https://github.com/ElwinErnst/billing-api/pull/28), [#29](https://github.com/ElwinErnst/billing-api/pull/29), [#30](https://github.com/ElwinErnst/billing-api/pull/30), [#31](https://github.com/ElwinErnst/billing-api/pull/31) | #31 `147a1ceb34ca478ce73c6af445c9172d09fc4749` |

## Root child PRs

| Order | Branch | Type | Scope | Original root commits |
|------:|--------|------|-------|-----------------------|
| 1 | `feat/saas-control-plane-root-services` | `type:feature` | Auth/Billing gitlinks and their root ODD evidence; gitlinks retargeted to the exact final commits above. | `32916f2`–`14a065d` (service-evidence commits only) |
| 2 | `feat/saas-control-plane-root-ui` | `type:feature` | Organization workspace UI, integration guide, and associated root task evidence. | `7e8aa61`, `e4a4445`, `20455f0`, `5d28e0c`, `29b9bae` |
| 3 | `fix/saas-control-plane-root-resilience` | `type:bug` | Per-organization tenant-load resilience, page tests, and policy editor state/lint fix. | `03b8dd0`, `ba539ba`, `0f6f457`, `649a5ac` |

Each root child targets the immediately preceding branch, and only this tracker ultimately targets `main`. Each slice is planned below 400 changed lines; no size exception is requested. Exact counts and checks are recorded in the child PRs after branch-diff verification.

## Verification

- Services/gitlinks: `git diff --check`; verify the Auth/Billing gitlink SHAs exist as published PR heads and the PR diff contains only root gitlinks plus task evidence.
- UI/docs: `cd sytadel-app && npm test`, `npm run lint`, `npm run build`, and `git diff --check` against the immediate base.
- Resilience/policy: repeat the App test/lint/build commands on this exact final tree and check the immediate-base diff.
- Every root PR must exclude `sytadel-growth-os`; that dirty gitlink is pre-existing and out of scope.

## Rollback

Close the draft tracker and revert only the relevant child slice if necessary. The services child changes root evidence/gitlink pointers only; UI/docs and resilience/policy are separate rollback boundaries. Retain Auth/Billing service PRs independently; do not reset or rewrite their histories.
