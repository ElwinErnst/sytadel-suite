# Feature: sytadel-web rebrand — enterprise security

## Objective
First pass of a visual rebrand of sytadel-web toward an **enterprise-security**
identity (serious, trustworthy; deep navy/slate, single confident blue accent,
restraint over neon). Direction chosen by user over "polish", "restructure",
"elevated violet".

## Approach (disciplined, token-first)
- Repoint `:root` design tokens in global.css (bg/panel/text/muted + the three
  accent tokens --violet/--blue/--pink) rather than editing rules one by one.
- Replace the three scattered hardcoded RGB triples across global.css in-place so
  every gradient/glow follows the new palette consistently.
- Kill the neon pink entirely (repointed to an in-family indigo).
- Cool the brand-mark SVG gradient (lavender → cool blue-white) in both frontends
  (SiteFrame + app splash index.astro).

## Palette map (old → new)
- violet #8a4dff / rgb(138,77,255) → #4f7cff / rgb(79,124,255)  (primary enterprise blue)
- blue   #1ea7ff / rgb(30,167,255) → #38bdf8 / rgb(56,189,248)  (sky/cyan secondary)
- pink   #ff4fd8 / rgb(255,79,216) → #6366f1 / rgb(99,102,241)  (indigo; removes neon)
- bg #060511→#080c18, bg-soft #0d0a1d→#0e1426, bg-deep #03030a→#05080f
- text #f6f7ff→#eef2fb, muted #b6b7d0→#93a0bd
- brand mark #F8F2FF→#F2F7FF, #E6D8FF→#CAD9FF

## Out of scope (this pass)
- Typography unchanged (Geist + Bricolage Grotesque kept). Font swap to a more
  corporate single-family is an easy follow-up if desired.
- No layout/structure changes (that was a different slice option).

## Tasks
- [x] Repoint tokens + scattered triples + body/panel + brand marks. Route: inline (token values; aesthetic judgment held by parent).
- [x] Build green + no leftover old-identity hexes. Verified `npm run build` + rg scan clean.
- [ ] Visual sign-off by user via Vercel preview (aesthetic call is the user's).

## Notes
- Stacked on feat/web-growthos (PR #81) so the preview shows content + rebrand together.
- Aesthetic acceptance is inherently the user's; this is a first pass to react to.
