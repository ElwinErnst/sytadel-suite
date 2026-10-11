# Feature: sytadel-labs.com refresh — GrowthOS as "prueba viva"

## Objective
Refresh the public marketing site (`sytadel-web`, deployed to sytadel-labs.com) to
reflect the current reality: Sytadel as a secure PaaS / control plane, the shipped
federated console + unified audit timeline, and GrowthOS positioned honestly as
**customer-zero / living proof (dogfooding)** — NOT as a sellable product.

## Problem / Why
- The hero already positions Sytadel as a PaaS; that part is current.
- GrowthOS is absent from the site. User initially wanted it sold as a public
  product, but the repo (README + ADR 0001/0002) explicitly and repeatedly states
  it is an **internal customer-zero engine, not a customer product**, licensed
  PolyForm Strict (noncommercial), CLI-first, with no outbound/autonomous surface.
  Selling it publicly would publish claims the product cannot back.
- DECISION (user, evidence-backed): present GrowthOS as **prueba viva / dogfooding**.
- The shipped console control-plane arc (unified audit timeline over
  vault/auth/zt/billing) is not reflected in the modules list.

## Scope (authorized)
- `sytadel-web/src/i18n/content.ts`: add a `growthOs` section (es/en/pt), honest
  dogfooding copy grounded in the real README; add a nav link + section id.
- `sytadel-web/src/pages/[lang]/index.astro`: render the new section (reuse
  existing `content-section` / `card-grid` / `feature-card` — no new CSS); add its
  kicker + id mapping.
- Add a `Sytadel Console` module card reflecting the shipped federated control
  plane + unified audit timeline across the 4 systems.
- OUT OF SCOPE (surface to user, do not invent): dormant/unrendered pricing block
  with placeholder numbers; any explicit license/legal copy (nothing false is
  currently shown).

## Constraints
- Artifact language = the site's existing trilingual content (es/en/pt). Neutral/
  professional register. No persona slang in copy.
- Honesty gate: no claim GrowthOS can't back. "Agents present evidence; the
  founder decides." Keep facts vs hypotheses framing.
- Static Astro site; verify with `npm run build`.

## TDD mode
Not applicable — static content site, no unit tests. Verification = `npm run build`
+ visual readback of rendered section. (Mode: off; source: project has no test
runner for web; runner: `npm run build`.)

## Tasks
- [x] T1 — content.ts: add `growthOs` block (es/en/pt) + nav link + Console module card. Route: inline (parent is positioning-context holder; copy IS the product decision — writer-trigger acknowledged, inline chosen to prevent honesty drift).
- [x] T2 — [lang]/index.astro: render section + kicker + id mapping. Route: inline (mechanical wiring dependent on T1 shape).
- [x] T3 — `npm run build` green + readback. Route: per-action. Evidence: build built /es /en /pt + root OK; rg over dist/*.html confirms id="growthos", kickers (Prueba viva / Customer-zero / Prova viva), titles, Founder Brief, Sytadel Console in all 3 locales.

## Acceptance
- Build passes; GrowthOS section renders in all 3 locales; nav anchor works.
- Copy makes no sellable-product claim; frames GrowthOS as customer-zero.
- Console module reflects real shipped control-plane.

## Progress
- Exploration done (content.ts, [lang]/index.astro, growth-os README) 2026-10-10.
- Delivery strategy: single-pr (ask-on-risk default; forecast < 400 authored lines).
