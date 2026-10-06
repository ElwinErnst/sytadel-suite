# SaaS Control Plane

## Objective

Make Sytadel a reusable control plane that a multi-tenant B2B SaaS can integrate without coupling Sytadel's own commercial subscription to the SaaS customer's subscriptions.

## Problem

The current model treats a tenant as both the security boundary and the billing customer. That works for direct Sytadel customers, but it cannot represent a SaaS company that pays Sytadel once, manages multiple customer tenants, and optionally uses Billing API to sell its own plans.

## Why

Separating organization ownership, security tenants, platform subscriptions, and merchant subscriptions enables reusable SaaS integrations while preventing third-party billing events from mutating Sytadel entitlements.

## Scope

- Add an organization/billing-account boundary above security tenants.
- Allow an organization to manage multiple tenants without introducing nested tenants.
- Keep Sytadel platform subscriptions separate from merchant/customer subscriptions.
- Add merchant-owned products, prices, customers, provider connections, and recurring subscriptions.
- Isolate inbound webhook verification and reconciliation by merchant/provider account.
- Provide an idempotent tenant-provisioning contract suitable for external SaaS backends.
- Document the generic integration flow.

## Constraints

- Do not modify or stage `sytadel-growth-os`; Claude owns that nested repository.
- Keep direct tenant subscription checkout and entitlement behavior available as a supported product path. Existing test-data rows do not require migration compatibility.
- A user account is never the billing owner; users administer organizations through memberships.
- Business data remains in the integrating SaaS. Sytadel stores identity, policy, billing, and custody metadata only.
- No provider call may silently fall back to global credentials for merchant-scoped billing.
- Authored changes should be split into reviewable PR slices around 400 lines when reasonably possible.

## Delivery

- Strategy: `auto-chain`
- Chain: `feature-branch-chain`
- Integration branch: `codex/saas-control-plane`
- Each task produces a Conventional Commit and a reviewable PR slice boundary.

## TDD and checks

- Effective TDD: off (no explicit project/session setting was found).
- Auth API: `npm test`, `npm run build`.
- Billing API: `npm test`, `npm run build`.
- Sytadel App: `npm test`, `npm run build` when UI changes begin.

## Tasks

- [x] **SCP-001 — Organization and billing-account foundation**
  - Add organizations above tenants and explicit tenant links.
  - Add organization memberships with owner/admin roles.
  - Preserve the existing flat tenant security boundary.
  - Route: delegated; writer trigger applies across Auth API entity, migration, service, controller, and tests.
  - Acceptance: one organization can link multiple tenants; tenant membership remains independent; tests prove authorization and uniqueness.

- [x] **SCP-002 — Platform subscription ownership**
  - Attach new Sytadel subscriptions to billing accounts rather than human users.
  - Support consolidated coverage of multiple tenants.
  - Preserve direct tenant subscriptions as a supported product capability; migration compatibility for existing test rows is not required.
  - Route: delegated; Auth API authorization contract plus Billing API ownership, coverage, and checkout behavior.
  - Acceptance: an organization can pay once for multiple covered tenants without changing user ownership semantics.
  - Rationale: Auth remains the authorization source of truth; Billing accepts only a signed Auth decision and persists account ownership and covered tenant IDs. Legacy tenant-owned rows remain supported, while current subscription rows are explicitly constrained to the PLATFORM domain; merchant billing will use a separate domain in SCP-003.

- [x] **SCP-003 — Merchant billing domain**
  - Add merchant accounts, customers, products, prices, and merchant subscriptions.
  - Ensure merchant subscriptions never update Sytadel platform entitlements.
  - Route: delegated; Billing API schema and behavior change.
  - Acceptance: a SaaS can sell its own recurring plan to one of its customer tenants independently of its Sytadel plan.
  - Rationale: merchant APIs are a distinct module/service with separate `merchant_*` tables and immutable tenant/merchant-scoped references. Auth JWT tenant ownership guards the merchant aggregate; external SaaS customer/tenant references remain opaque and are not treated as Auth tenant IDs. Merchant subscription records are local merchant ledger state; checkout, provider credentials, and webhook reconciliation are intentionally deferred to SCP-004.

- [x] **SCP-004 — Provider and webhook isolation**
  - Resolve provider credentials per merchant/application/environment.
  - Remove global fallback from merchant-scoped operations.
  - Verify inbound signatures and reconcile events against the owning provider account.
  - Route: delegated; security-sensitive cross-file change.
  - Acceptance: events and credentials cannot cross merchant boundaries.
  - Rationale: merchant connections and event inbox are isolated in `merchant_provider_*` tables and bound to an owning merchant by composite FKs. Secrets use the existing AES-256-GCM `SecretCipher`, but this path fails closed unless the encryption key is configured; credential resolution requires the exact active merchant connection and has no global platform fallback. Stripe webhooks use that connection's signing secret. Mercado Pago notifications are verified against the connection secret, then the authoritative preapproval is fetched with that same connection's access token. Reconciliation queries only merchant subscriptions linked to the exact connection and provider subscription ID; platform webhook/entitlement handlers remain unchanged. Provider events are connection-scoped and idempotent; Stripe updates use row locking, event timestamps, and terminal cancellation semantics to avoid stale reactivation.
  - Scope note: merchant owners supply optional application/environment UUID scope labels; Billing has no Auth contract for validating those IDs, so this work does not claim cross-service application/environment authorization. Merchant ownership remains enforced by the authenticated tenant and merchant ID.

- [x] **SCP-005 — Idempotent SaaS provisioning API**
  - Add an idempotent workflow for organization, tenant, membership, application, environment, and service-account provisioning.
  - Expose recoverable provisioning state rather than distributed transactions.
  - Approved invoker: only the trusted internal Sytadel backend through Auth API's existing signed internal-service boundary; UI users do not invoke infrastructure creation directly.
  - Route: delegated; mapping read 4+ Auth/Billing files and implementation spans Auth API controller, service, entity, migration, encryption seam, and focused tests (writer trigger).
  - Effective TDD: off, from this task document; ordinary functional checks use Auth API `npm test` and `npm run build`.
  - Authorized scope: `auth/auth-api` and this task document/Engram mirror. Billing stays unchanged unless implementation evidence proves an existing contract requires it. Never touch, stage, or commit `sytadel-growth-os`.
  - Work-unit checklist:
    - [x] Persist caller/key-scoped idempotency state, normalized request fingerprint, recoverable status/step/error, and created resource IDs.
    - [x] Add internal-only provisioning and status routes; atomically create organization/billing account/owner, tenant/owner/link, app/default production environment, and service account.
    - [x] Encrypt the generated service-account secret for same-key replay; never persist plaintext or return a different secret on replay.
    - [x] Add focused tests for replay, concurrent duplicate requests, partial-failure retry, caller/key isolation, and credential-loss/replay behavior.
  - Acceptance: PASS — trusted backend retries and concurrent duplicate submissions for the same idempotency key return the same provisioned resources and credential without duplicates; different caller/key scopes are isolated; a failed operation exposes recoverable state and can resume safely; no public/UI endpoint bypasses Auth API entitlements.
  - Verification: Auth API `npm test`, `npm run build`, and `git diff --check`; runtime harness or explicit N/A with exact reason.
  - Forecast: approximately 700 authored lines; actual work unit: 1,031 authored additions. One cohesive Auth-only work unit; the advisory 400-line target does not justify splitting atomic provisioning behavior or omitting regression coverage.
  - Rationale: Auth owns user/organization/tenant/application/environment/service-account state; Billing currently consumes Auth for platform checkout and tenant billing synchronization but has no provisioning API. Avoid unnecessary cross-service coupling. The Auth API had no reusable secret-encryption facility; a dedicated AES-256-GCM seam with a required 32-byte base64 key supports replayable credential delivery without plaintext storage.

- [ ] **SCP-006 — Control-plane UI and integration guide**
  - Add organization/tenant administration to Sytadel App.
  - Document the generic FastAPI/backend integration and trust boundaries.
  - Route: delegated direct; exploration mapped 4+ frontend/Auth/documentation files, and the writer spans the App Router, Auth client/types/tests/navigation plus a new integration guide (mandatory multi-file writer trigger).
  - Effective TDD: off, from this task document; ordinary functional checks use `cd sytadel-app && npm test`, `npm run lint`, and `npm run build`.
  - Authorized scope: `sytadel-app`, `docs/saas-control-plane-integration.md`, this task document, and its Engram mirror. Auth/Billing backend contracts stay unchanged unless implementation evidence proves otherwise. Never touch, stage, or commit `sytadel-growth-os`.
  - Preserve the existing direct-tenant creation flow as a supported legacy/direct product path. Organization visibility is additive.
  - Work units:
    - [x] **SCP-006-A — Organization workspace UI:** PASS — authenticated organization and managed-tenant visibility uses existing JWT-guarded Auth routes; role is shown from organization membership; no unsupported management controls, internal provisioning calls, or credential handling. Commit `7e8aa61` (`feat(app): add organization workspace visibility`), 187 authored additions.
    - [ ] **SCP-006-B — SaaS integration guide:** document the FastAPI/backend onboarding happy path, internal HMAC trust boundary, idempotency and retry, one-time service-account credential custody, entitlement sequencing, organization visibility, and integrating-SaaS data ownership; link it from the App README.
  - Acceptance: an authenticated organization member can find their organizations and linked tenants; an authorized owner/admin sees only supported administration affordances; internal provisioning and generated credentials remain backend-only; a reader can follow the documented trusted-backend onboarding sequence without exposing secrets to the UI.
  - Verification: App `npm test`, `npm run lint`, `npm run build`; `git diff --check` and committed diff checks; structural route/config/link readback against current Auth code; UI runtime/browser check if Auth-backed local login is available, otherwise explicit N/A with reason.
  - Forecast: approximately 500 authored lines across two cohesive work units (advisory only; do not omit coverage or compress docs to fit a budget).

## Progress

- 2026-10-02: Requirements explored against Auth API, Billing API, and Sytadel App. Feature-branch-chain selected by the user.
- 2026-10-02: Implemented SCP-001 in `auth/auth-api` on `codex/saas-control-plane`. The Auth API is a nested Git repository, so implementation and parent evidence are separate commits; the parent commit records the Auth API gitlink and this task document.
- 2026-10-02: Applied the single review correction for `R3-tenant-authorization`: linking now requires the actor to be an active OWNER/ADMIN in both the receiving organization and target tenant. Added rejection coverage for an organization admin without target-tenant authority; the authorized owner path remains covered.
- 2026-10-02: SCP-002 architecture decision approved: Auth API owns authorization and will expose a signed/internal contract validating the acting user's active organization membership, billing-account ownership, and requested covered tenants' organization links/authority. Billing API must consume only the trusted result and must not duplicate Auth membership logic or trust client-supplied account/tenant IDs.
- 2026-10-03: Implemented SCP-002 across Auth API and Billing API on `codex/saas-control-plane`. Auth validates organization owner/admin membership, billing-account ownership, linked tenant coverage, and active tenant owner/admin authority. Billing adds organization-owned platform checkout/cancellation, per-tenant entitlement propagation, consolidated billing-period usage, and keeps existing tenant-owned subscriptions compatible.
- 2026-10-03: Reopened SCP-002 after manual review of the committed Billing implementation found tenant/customer uniqueness, asymmetric active/pending conflict checks, nullability metadata drift, pending checkout recovery, and cancellation entitlement fallback gaps. The user confirmed that existing billing rows are test data only and backward-compatible migration is unnecessary; direct tenant subscriptions remain a supported checkout path.
- 2026-10-03: Corrected SCP-002 on Billing only: account customers now persist with `tenant_id = NULL`; direct and account checkout reject conflicting ACTIVE/PENDING coverage before provider session creation; canceling one subscription reapplies another ACTIVE subscription's plan for overlapping coverage; subscription and period-close ORM tenant columns match nullable schema; mismatched pending checkouts are retired only after local mock invalidation or provider-confirmed Stripe/Mercado Pago expiration, and late notifications cannot reactivate retired checkouts.
- 2026-10-03: Implemented SCP-003 in a separate Billing merchant domain. Tenant owners can create/list merchant accounts, define products/prices, represent external SaaS customers/customer tenants, create active recurring subscription records from merchant-owned prices, archive catalog entries, and cancel subscriptions. All customer, product, price, and subscription queries are scoped to the owning merchant; composite database FKs prevent cross-merchant references. Merchant subscriptions use separate tables and no path into `BillingService.applyTenantPlanFromSubscription` or platform provider webhooks.
- 2026-10-04: Implemented SCP-004 as a merchant-only provider boundary. Merchant connections persist encrypted provider access and webhook secrets, expose metadata only, and fail closed when the cipher key is missing. Merchant subscriptions may link an external subscription ID to one active merchant connection. Signed Stripe/Mercado Pago notifications are scoped to the connection; Mercado Pago subscription state is fetched from the provider with that connection's credential before reconciliation. Event inbox uniqueness and subscription matching include the connection/merchant boundary; platform provider credentials, webhooks, and entitlements are untouched. Independent review caught and this work corrected Mercado Pago resource-ID-only deduplication and stale/out-of-order Stripe status application; tests now cover retry identity, stale Stripe events, invalid merchant signatures, encrypted secret serialization, and connection isolation.
- 2026-10-04: Follow-up correction after terminal targeted-validator rejection for prior candidate `6e6ab2234a05befe5b9151ae2b1ad87f57e939e5`: the `<=` timestamp guard rejected equal-timestamp terminal cancellation after activation, making final status order-dependent. This was a new ODD work unit, not a continuation of terminal review lineage `review-801f3f4603ac70be`. Terminal cancellation now wins equal timestamp ties regardless of arrival order; recoverable and active events at equal time do not displace it. New handler-level tests cover equal-time Active/Canceled and Past Due/Canceled events in both delivery orders; newer recovery and older-activation rejection remain covered.
- 2026-10-04: Follow-up after the terminal review's Mercado Pago finding: the provider webhook handler now maps `authorized`, `pending`, `paused`, and terminal `cancelled` separately; unsupported/malformed subscription statuses return an error without mutating the merchant subscription or recording an event. Tests prove Pending recovery to Authorized, terminal cancellation remains terminal, unsupported statuses do not cancel, and Stripe stale/tie ordering remains protected.
- 2026-10-04: Final SCP-004 candidate passed native review lineage `review-74211b38535ce7e5`; approval was acknowledged and review authority burned. The final review reported two informational follow-ups, not blockers: equal-timestamp nonterminal events can remain arrival-dependent, and unmatched events received before local subscription binding can be deduplicated before reconciliation.
- 2026-10-04: Implemented SCP-005 in Auth API only under the approved trusted-internal-backend invocation boundary. The HMAC-guarded internal controller now offers provisioning and status routes; an idempotency ledger stores caller/key, normalized request hash, status/current step/safe error code, resource IDs, and AES-256-GCM-encrypted service-account secret. A row lock serializes same-key calls; one Auth database transaction creates the organization, billing account, organization owner, FREE tenant, tenant owner/link, app, production environment, and least-privilege service account. Failed transactions roll resource writes back and persist recoverable failure state separately; retry resumes safely. Same-key/same-payload replay returns the same credential, changed payload is rejected, and status reads do not expose credentials. The API does not call Billing and does not alter public entitlement guards. Auth commit `45679ced0e1d5699a6bdca729450159bc5590639` contains 1,031 authored lines; parent evidence commit is tracked separately.
- 2026-10-06: Completed SCP-006-A. The new App Router organization workspace uses `GET /organizations` and `GET /organizations/:organizationId/tenants` through the existing JWT client/session path. It displays organization and tenant names/slugs/status plus organization role, with no internal provisioning route, secret, invitation, unlink, or deactivation surface. The legacy direct tenant creation flow remains unchanged as explicitly requested. App work-unit commit `7e8aa61` contains 187 authored additions.

## Verification evidence

- `cd auth/auth-api && npm test` — PASS: 9 suites, 50 tests.
- `cd auth/auth-api && npm run build` — PASS (`nest build`).
- `git diff --check` — PASS; staged Auth API files contained no whitespace errors.
- Structural check — PASS: the Auth API commit contains only Auth API files; the parent evidence commit stages only this task document and the `auth/auth-api` gitlink. `sytadel-growth-os` was not staged or modified by this task.
- Auth implementation commit: `7c4a639670712ecd3ceefa7d85547361f4a09f09` (`feat(auth): add organization billing foundation`), 752 authored lines.
- Review correction commit: `f32046126de71a11d5e40f277e8926d189f5edc0` (`fix(auth): require tenant authority before organization linking`), 41 authored lines. `cd auth/auth-api && npm test` — PASS: 9 suites, 51 tests. `cd auth/auth-api && npm run build` — PASS (`nest build`). `git diff --check` — PASS.
- `cd auth/auth-api && npm test` — PASS: 9 suites, 55 tests.
- `cd auth/auth-api && npm run build` — PASS (`nest build`).
- `cd billing/billing-api && npm test` — PASS: 24/24 tests.
- `cd billing/billing-api && npm run build` — PASS (`nest build`).
- `git -C auth/auth-api show --format= --check 950eeb076f7e68d51d5ab26a99b1f53049ab2a65` — PASS.
- `git -C billing/billing-api show --format= --check 965de9f4f909fdc16329c98cd8c40240bc6ab70f` — PASS.
- Root `git diff --check` — PASS. Structural check — PASS for committed/staged scope: Auth API and Billing API gitlinks plus this task document only; `sytadel-growth-os` was already a dirty gitlink before SCP-002 resumed and was not staged, committed, or edited by this worker. No live runtime harness was run: exercising organization checkout requires configured database/Auth API/payment-provider services; tests/build were run locally without provisioning infrastructure or calling providers (Auth has e2e script, Billing does not).
- Auth API implementation commit: `950eeb076f7e68d51d5ab26a99b1f53049ab2a65` (`feat(auth): authorize platform subscription coverage`), 196 authored lines.
- Billing API implementation commit: `965de9f4f909fdc16329c98cd8c40240bc6ab70f` (`feat(billing): add organization-owned platform subscriptions`), 750 authored lines. One cross-service SCP-002 behavior remains one review slice (946 authored changed lines, additions plus deletions across the two submodules) because splitting the authorization contract from the consuming checkout/entitlement path would leave either side unusable; the 400-line budget is advisory and no tests or docs were omitted.
- Rollback boundary: revert the root SCP-002 evidence commit and the two SCP-002 submodule commits. This removes account-owned checkout/cancellation, the Auth authorization endpoint, account customer/subscription fields, coverage propagation, and migration; existing tenant subscription rows and organization/tenant memberships remain unchanged. Do not roll back after account-owned subscriptions have been created unless first migrating/canceling those subscriptions, since the legacy schema cannot represent their billing-account owner.
- RDD: pending; no review assessment or native lifecycle was run by this worker. The parent orchestrator owns the applicable assessment/review.
- SCP-002 correction commit: `090e46432f37aedfa7f5ccf1e657088e93cdf00a` (`fix(billing): harden platform subscription ownership`), 457 authored changed lines. `cd billing/billing-api && npm test` — PASS: 33/33 tests, including customer uniqueness transition, bidirectional active/pending conflict rejection, cancellation entitlement fallback, nullability metadata, mock/Stripe/Mercado Pago pending checkout expiration, and late-event protection. `cd billing/billing-api && npm run build` — PASS (`nest build`). `git -C billing/billing-api show --format= --check 090e46432f37aedfa7f5ccf1e657088e93cdf00a` — PASS. No live runtime harness was run: the billing API needs a configured database, Auth API, and provider credentials to exercise checkout/webhook lifecycle end to end; the focused repository/service tests run without external services. No migration was added because the schema already permits null account-owned tenant IDs and all current rows are test data.
- Correction rollback boundary: revert Billing commit `090e46432f37aedfa7f5ccf1e657088e93cdf00a` and the corresponding root gitlink/task-document evidence commit. This restores the prior account-customer tenant anchor, one-way conflict checks, FREE-on-cancel behavior, and pending state behavior. Do not apply against production data until manually assessing pending provider sessions; this project has no real customers and the user approved test-data-only handling. Native review lineage `review-689637f43fed3afe` is terminal `native_stop_required`; it was not resumed or changed. RDD assessment/review for this new correction candidate is pending parent-owned review.
- SCP-003 commit: `c424803b1e5891165113cfa0ff8d9e7d971f7115` (`feat(billing): add isolated merchant subscription domain`), 1,067 authored lines. `cd billing/billing-api && npm test` — PASS: 39/39 tests, including merchant product/price/customer/subscription creation, cross-tenant and cross-merchant isolation, external customer uniqueness, service-account rejection, and idempotent cancellation. `cd billing/billing-api && npm run build` — PASS (`nest build`). `git -C billing/billing-api show --format= --check c424803b1e5891165113cfa0ff8d9e7d971f7115` — PASS. `git -C billing/billing-api diff --check` — PASS before commit. No live runtime harness or PostgreSQL migration execution: local checkout lacks the external database/provider/Auth deployment needed for an end-to-end flow; the focused service tests run without external infrastructure. Migration constraints are structurally reviewed but not runtime-executed.
- SCP-003 rollback boundary: revert Billing commit `c424803b1e5891165113cfa0ff8d9e7d971f7115` and its root Billing gitlink/task-document evidence commit. This removes the `MerchantBillingController`/`MerchantBillingService`, merchant entities/DTOs, and migration for `merchant_accounts`, `merchant_products`, `merchant_prices`, `merchant_customers`, and `merchant_subscriptions`; no platform subscription tables or entitlements are changed. The migration's restrictive foreign keys prevent deletion from cascading away merchant subscription history. Existing billing data is test-only.
- SCP-003 RDD: parent-owned and pending assessment/review for the new work-unit candidate; no native review lifecycle was started by this worker.
- SCP-004 Billing commit: `bac3515d94fc477ba75f4851332074db5d6678c6` (`feat(billing): isolate merchant providers and webhooks`), 652 authored changed lines. `cd billing/billing-api && npm test` — PASS: 46/46 tests. `cd billing/billing-api && npm run build` — PASS (`nest build`). `git -C billing/billing-api show --format= --check bac3515d94fc477ba75f4851332074db5d6678c6` — PASS. `git -C billing/billing-api diff --check` — PASS before commit. An independent source review also reran tests/build and confirmed migration/entity partial-index alignment; its findings on duplicate Mercado Pago delivery keys and stale Stripe events were corrected and retested. Runtime/PostgreSQL/provider integration is N/A: this repository has no configured local PostgreSQL/provider harness for end-to-end webhooks, and no live provider or Auth service was provisioned/called; the service-level tests exercise the signature, ownership, reconciliation, and idempotency logic without external infrastructure. Schema migration SQL was inspected but not executed against PostgreSQL.
- SCP-004 rollback boundary: revert Billing commit `bac3515d94fc477ba75f4851332074db5d6678c6` and the corresponding root gitlink/task-document evidence commit. This removes merchant provider connections/event inbox, subscription provider linkage, API routes, and migration; it does not alter platform provider configurations, platform webhooks, or platform entitlements. Before rollback after real merchant traffic exists, disable merchant webhook delivery and preserve/reconcile provider event and merchant subscription records; current project data is test-only. RDD remains parent-owned and pending assessment/review; this worker did not start or reopen native review.
- SCP-004 terminal tie-break commit: `8f0a02654f0171ab499bab86c4dbfb4b343fad3d` (`fix(billing): prioritize terminal webhook cancellation`), 31 authored changed lines. `cd billing/billing-api && npm test` — PASS: 48/48 tests, including both equal-timestamp arrival orders for Active/Canceled and Past Due/Canceled, newer Past Due-to-Active recovery, and older Active-after-newer-Canceled rejection. `cd billing/billing-api && npm run build` — PASS (`nest build`). `git -C billing/billing-api show --format= --check 8f0a02654f0171ab499bab86c4dbfb4b343fad3d` — PASS. `git -C billing/billing-api diff --check` — PASS before commit. Runtime/PostgreSQL/provider integration remains N/A because no local PostgreSQL/provider webhook harness is configured; this focused follow-up does not require external infrastructure.
- SCP-004 follow-up rollback boundary: revert Billing commit `8f0a02654f0171ab499bab86c4dbfb4b343fad3d` and its root Billing gitlink/task-document evidence commit to restore the prior timestamp tie handling. This rollback does not undo the earlier recoverable-status distinction in `6e6ab22` or the merchant-provider isolation in `bac3515`; review of the new candidate is RDD parent-owned and pending.
- SCP-004 Stripe recoverability commit: `6e6ab2234a05befe5b9151ae2b1ad87f57e939e5` (`fix(billing): preserve recoverable provider states`). It preserves recoverable Stripe statuses instead of making them terminally canceled. The targeted validator found an equal-timestamp terminal-cancellation regression; this commit is retained as the base correction, and the tie-break fix is recorded in the subsequent `8f0a026` candidate.
- SCP-004 Mercado Pago status commit: `ae9429f9b8f61b0e63e0359d04b5f113a73889d0` (`fix(billing): handle recoverable Mercado Pago states`), 53 authored changed lines. `cd billing/billing-api && npm test` — PASS: 49/49 tests; `cd billing/billing-api && npm run build` — PASS (`nest build`); `git -C billing/billing-api show --format= --check ae9429f9b8f61b0e63e0359d04b5f113a73889d0` — PASS. Runtime integration remains N/A because no local PostgreSQL/provider webhook harness is configured. This commit and prior Stripe/tie-break corrections were included in native review lineage `review-74211b38535ce7e5`, which completed approved, was acknowledged, and burned its authority.
- Final native review follow-ups (informational, not blockers): equal-timestamp nonterminal webhook updates may still depend on arrival order; unmatched provider events received before local subscription binding may be deduplicated before they can reconcile. Preserve as follow-up considerations for future webhook-ledger work.
- SCP-004 final-candidate RDD: parent-owned review completed and acknowledged for `review-74211b38535ce7e5`; this task did not run another review. Root evidence commit `4180d716a3c31901c2e6a775dc52cb0c2eab2e07` recorded the preceding equal-time correction; this final tracking update adds only Billing gitlink + task doc.
- Rollback boundary: revert the Auth API implementation commit and parent evidence commit; this removes the organization/billing-account schema and API without changing tenant membership semantics or existing tenant endpoints. Existing tenant data remains untouched.
- SCP-005 verification: `cd auth/auth-api && npm test` — PASS: 11 suites, 63 tests, including same-key replay, concurrent duplicate calls, failure rollback/retry, failure-vs-success race, caller/key isolation, ciphertext tamper rejection, and credential-safe status. `cd auth/auth-api && npm run build` — PASS (`nest build`). `git diff --check` — PASS before commit; `git show --format= --check 45679ced0e1d5699a6bdca729450159bc5590639` — PASS. No runtime/PostgreSQL harness was run: no configured local Auth/PostgreSQL integration environment or internal caller credentials were available; the repo's unit tests use an in-memory transactional harness. Billing was not changed or called.
- SCP-005 Auth commit: `45679ced0e1d5699a6bdca729450159bc5590639` (`feat(auth): add idempotent internal SaaS provisioning`), 1,031 authored lines across Auth API code, tests, migration, env example, and route documentation. No Billing files changed.
- SCP-005 parent evidence commit: `16f538eff6c6416d2fa7519343c8c18f06c9ce34` (`docs(odd): record SCP-005 provisioning workflow`), containing only the Auth API gitlink and this task document; `git show --format= --check 16f538eff6c6416d2fa7519343c8c18f06c9ce34` — PASS. Parent worktree structural check passed with only the pre-existing `sytadel-growth-os` dirty state remaining.
- SCP-005 rollback boundary: revert Auth commit `45679ced0e1d5699a6bdca729450159bc5590639` and the corresponding parent gitlink/task-document evidence commit. This removes the internal provisioning/status routes, operation ledger, encrypted replay credential records, and the client-app tenant/slug unique index; the organization, tenant, membership, app, environment, and service-account rows already provisioned remain in their domain tables. Do not drop the operation table while pending/failed operations or credential replay obligations remain; preserve the encryption key and ledger records until they are resolved. `AUTH_PROVISIONING_SECRET_ENCRYPTION_KEY` must remain stable; planned key rotation needs a migration/dual-key read path for retained ciphertext.
- SCP-005 entitlement boundary: provisioned tenants remain `FREE` with no API add-ons and `billingBypass=false`; the trusted internal route narrowly creates bootstrap resources without calling the public API-entitlement guard. Service-account token issuance and public app/service-account management continue to enforce normal Auth API entitlements. A SaaS backend must complete the platform/API entitlement flow before using the created account for API calls.
- SCP-005 RDD: parent-owned and pending assessment/review of the new Auth work-unit candidate; no native review lifecycle was started by this worker.
- SCP-006-A verification: `cd sytadel-app && npm test` — PASS: 3 files, 8 tests. `cd sytadel-app && npm run build` — PASS; Next generated `/app/organizations` as a dynamic server-rendered route. `cd sytadel-app && npm run lint` — FAIL on unchanged `src/features/zero-trust/policy-editor.tsx:203` (`react-hooks/refs`, ref access during render); targeted `npx eslint` over every SCP-006-A changed file — PASS. `git diff --check` and `git show --format= --check 7e8aa61` — PASS. UI runtime/browser verification is deferred to final task verification; the route requires a live authenticated Auth API session.
- SCP-006-A rollback boundary: revert `7e8aa61` to remove the organization workspace page, sidebar entry, API client/types, and focused tests; no Auth/Billing schema or direct tenant creation behavior is changed. Parent tracking commit will record this task document and the app work-unit evidence.
- SCP-006-A RDD: parent-owned/pending assessment; no native review lifecycle was started by this worker.

## Next step

Proceed with SCP-006: add organization/tenant administration to Sytadel App and document the generic FastAPI/backend integration. SCP-005's RDD assessment/review remains parent-owned and pending.
