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
- Existing direct tenant subscriptions must remain compatible during migration.
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

- [ ] **SCP-002 — Platform subscription ownership**
  - Attach new Sytadel subscriptions to billing accounts rather than human users.
  - Support consolidated coverage of multiple tenants.
  - Preserve a compatibility path for existing tenant subscriptions.
  - Route: delegated; Billing API cross-file change.
  - Acceptance: an organization can pay once for multiple covered tenants without changing user ownership semantics.

- [ ] **SCP-003 — Merchant billing domain**
  - Add merchant accounts, customers, products, prices, and merchant subscriptions.
  - Ensure merchant subscriptions never update Sytadel platform entitlements.
  - Route: delegated; Billing API schema and behavior change.
  - Acceptance: a SaaS can sell its own recurring plan to one of its customer tenants independently of its Sytadel plan.

- [ ] **SCP-004 — Provider and webhook isolation**
  - Resolve provider credentials per merchant/application/environment.
  - Remove global fallback from merchant-scoped operations.
  - Verify inbound signatures and reconcile events against the owning provider account.
  - Route: delegated; security-sensitive cross-file change.
  - Acceptance: events and credentials cannot cross merchant boundaries.

- [ ] **SCP-005 — Idempotent SaaS provisioning API**
  - Add an idempotent workflow for organization, tenant, membership, application, environment, and service-account provisioning.
  - Expose recoverable provisioning state rather than distributed transactions.
  - Route: delegated; Auth and Billing integration change.
  - Acceptance: retries do not duplicate tenants or credentials and partial failures remain recoverable.

- [ ] **SCP-006 — Control-plane UI and integration guide**
  - Add organization/tenant administration to Sytadel App.
  - Document the generic FastAPI/backend integration and trust boundaries.
  - Route: delegated; multi-file Next.js and documentation change.
  - Acceptance: an organization owner can see managed tenants and follow a verified onboarding sequence.

## Progress

- 2026-10-02: Requirements explored against Auth API, Billing API, and Sytadel App. Feature-branch-chain selected by the user.
- 2026-10-02: Implemented SCP-001 in `auth/auth-api` on `codex/saas-control-plane`. The Auth API is a nested Git repository, so implementation and parent evidence are separate commits; the parent commit records the Auth API gitlink and this task document.
- 2026-10-02: Applied the single review correction for `R3-tenant-authorization`: linking now requires the actor to be an active OWNER/ADMIN in both the receiving organization and target tenant. Added rejection coverage for an organization admin without target-tenant authority; the authorized owner path remains covered.

## Verification evidence

- `cd auth/auth-api && npm test` — PASS: 9 suites, 50 tests.
- `cd auth/auth-api && npm run build` — PASS (`nest build`).
- `git diff --check` — PASS; staged Auth API files contained no whitespace errors.
- Structural check — PASS: the Auth API commit contains only Auth API files; the parent evidence commit stages only this task document and the `auth/auth-api` gitlink. `sytadel-growth-os` was not staged or modified by this task.
- Auth implementation commit: `7c4a639670712ecd3ceefa7d85547361f4a09f09` (`feat(auth): add organization billing foundation`), 752 authored lines.
- Review correction commit: `f32046126de71a11d5e40f277e8926d189f5edc0` (`fix(auth): require tenant authority before organization linking`), 41 authored lines. `cd auth/auth-api && npm test` — PASS: 9 suites, 51 tests. `cd auth/auth-api && npm run build` — PASS (`nest build`). `git diff --check` — PASS.
- Rollback boundary: revert the Auth API implementation commit and parent evidence commit; this removes the organization/billing-account schema and API without changing tenant membership semantics or existing tenant endpoints. Existing tenant data remains untouched.

## Next step

Proceed with SCP-002: move new Sytadel platform-subscription ownership to billing accounts while preserving compatibility for existing tenant subscriptions. No review assessment was run by this worker; the parent orchestrator owns any applicable native review lifecycle.
