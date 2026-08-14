# Sytadel Web

Landing multilenguaje de Sytadel Labs construida con Astro.

## Stack
- Astro
- TypeScript
- CSS global

## Desarrollo

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Interactive demo

The landing embeds a live "try it" console (`src/components/DemoConsole.astro`)
that lets a visitor chat with Claude while it drives the same tools the Sytadel
MCP server exposes, over a read-only **fixture** demo tenant. The site itself is
a fully static build; the agent loop runs server-side in a single Vercel
serverless function (`api/demo.ts`, picked up automatically from `/api`). Where
the site is served without a runtime (e.g. the self-hosted Docker stack), the
route is absent and the client degrades gracefully to an "unavailable" message.

Environment:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | yes (for the demo) | — | Server-side key for the demo agent. Without it, the demo degrades gracefully to an "unavailable" message. |
| `DEMO_MODEL` | no | `claude-haiku-4-5-20251001` | Model used by the demo agent. |
| `UPSTASH_REDIS_REST_URL` | no | — | Upstash Redis REST URL. With the token below, the demo rate limiter uses a sliding window shared across all serverless instances. |
| `UPSTASH_REDIS_REST_TOKEN` | no | — | Upstash Redis REST token. Without both Upstash vars, the limiter falls back to a per-instance in-memory window. |

The demo is a curated sandbox: fictional data, read-only, hard caps on turns and
tokens per request. See `src/lib/demo/` (`fixtures.ts`, `tools.ts`, `agent.ts`).

## Estructura útil

- `src/pages/[lang]/index.astro`: home por idioma
- `src/i18n/content.ts`: copy y metadata
- `src/components/SiteFrame.astro`: shell compartido
- `src/components/DemoConsole.astro`: consola de demo interactiva
- `src/lib/demo/`: fixtures, tools y loop agéntico del demo
- `api/demo.ts`: función serverless (Vercel) del demo
- `src/layouts/BaseLayout.astro`: metadata global
- `src/styles/global.css`: estilos globales

## Dominio

El sitio está configurado para `https://sytadel-labs.com`.
