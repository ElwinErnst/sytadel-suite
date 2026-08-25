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

## Demo animation

The landing embeds a **scripted animation** (`src/components/DemoConsole.astro`)
that replays canned agent sessions — a prompt, the agent "thinking", the MCP
tools it calls with their results, and its reply. It is 100% client-side: no
network, no LLM, no API key, **no per-visitor cost**. That's deliberate — a
public LLM endpoint is a cost/abuse magnet, so the public site only shows how it
works. (The real agent lives in the backend services; see the MCP server and the
`access-request` module.) It respects `prefers-reduced-motion` (renders without
typing/looping) and loops gently through a few scenarios with a Replay control.

## Estructura útil

- `src/pages/[lang]/index.astro`: home por idioma
- `src/i18n/content.ts`: copy y metadata
- `src/components/SiteFrame.astro`: shell compartido
- `src/components/DemoConsole.astro`: animación scripted del demo (sin backend)
- `src/layouts/BaseLayout.astro`: metadata global
- `src/styles/global.css`: estilos globales

## Dominio

El sitio está configurado para `https://sytadel-labs.com`.
