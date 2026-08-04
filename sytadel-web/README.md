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

## Estructura útil

- `src/pages/[lang]/index.astro`: home por idioma
- `src/i18n/content.ts`: copy y metadata
- `src/components/SiteFrame.astro`: shell compartido
- `src/layouts/BaseLayout.astro`: metadata global
- `src/styles/global.css`: estilos globales

## Dominio

El sitio está configurado para `https://sytadel-labs.com`.
