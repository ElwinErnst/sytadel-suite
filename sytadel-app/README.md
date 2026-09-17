# Sytadel App

Dashboard operativo de Sytadel Suite para el MVP de `Auth + Vault`.

## Qué es y rol en Sytadel

Es la **consola operativa** de la suite: la UI que un operador usa para manejar auth, vault y billing. No es un módulo standalone reutilizable — es un *cliente* del control plane y no hace nada sin los servicios backend corriendo detrás. Ver la [suite](../README.md).

## Qué incluye hoy

- login contra `auth-api`
- sesión segura en cookies `httpOnly`
- shell enterprise oscura alineada con la paleta de Sytadel
- resumen de tenant, plan y capacidades
- gestión básica de memberships por tenant
- gestión de vaults
- upload, download y delete de documentos vía `zerotrust-api`

## Variables esperadas

Defaults locales:

- `AUTH_API_URL=http://localhost:3002/api`
- `ZT_API_URL=http://localhost:3010`

## Uso en desarrollo

```bash
npm install
npm run dev
```

La app queda en `http://localhost:3003`. Requiere `auth-api` y `zerotrust-api` alcanzables (por eso normalmente se corre junto a la suite: `docker compose up` desde la raíz).

## Uso en la suite

Desde la raíz del meta-repo, `docker compose up --build` la levanta apuntada a los servicios internos (`http://auth-api:3001/api`, `http://zerotrust-api:3010`, etc.).

## Licencia

Apache-2.0. Ver el [LICENSE de la suite](../LICENSE).
