# Sytadel App

Dashboard operativo de Sytadel Suite para el MVP de `Auth + Vault`.

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

## Comandos

```bash
npm install
npm run dev
```

La app queda en `http://localhost:3003`.
