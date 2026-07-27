# Integracion de Auth + Zero Trust en un proyecto externo

Esta guia resume como integrar un cliente o backend externo con `auth-api` y `zerotrust-api` de Sentinel.

## Arquitectura

Flujo vigente:

1. El cliente hace login contra `auth-api`.
2. `auth-api` devuelve `accessToken` y `refreshToken`.
3. El cliente llama a `zerotrust-api` con `Authorization: Bearer <accessToken>`.
4. `zerotrust-api` valida el JWT, aplica policy y firma la request downstream.
5. `vault-api` acepta solo requests firmadas por Zero Trust.

Puntos importantes:

- `auth-api` es la fuente de verdad de tenants y memberships.
- Los clientes no deberian llamar `vault-api` directo.
- El acceso recomendado a Vault es siempre via `zerotrust-api`.

## Base URLs locales

- `AUTH_API_URL=http://localhost:3002/api`
- `ZT_API_URL=http://localhost:3010`
- `VAULT_API_URL=http://localhost:3000`

En un cliente externo normalmente solo necesitas:

- `AUTH_API_URL`
- `ZT_API_URL`

## Endpoints de Auth

Endpoints principales:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`

### Login

Request:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "123456",
  "tenantSlug": "sentinel-labs"
}
```

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000
}
```

Notas:

- El login requiere `tenantSlug` o `tenantId`.
- El usuario debe tener membership activa en ese tenant.
- El JWT emitido esta pensado para `zerotrust-api`.

### Perfil actual

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

Devuelve usuario, tenant actual, roles y `sessionId`.

### Refresh

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh-token>"
}
```

Devuelve un nuevo par de tokens. El refresh token es rotativo.

### Logout

```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "<refresh-token>"
}
```

O bien:

```json
{
  "sessionId": "<session-id>"
}
```

## Endpoints de negocio via Zero Trust

El gateway publica `vault-api` bajo el prefijo `/vault`.

Ejemplos utiles:

- `GET /vault/tenants`
- `POST /vault/vaults`
- `GET /vault/vaults`
- `DELETE /vault/vaults/:id`
- `POST /vault/documents?vaultId=...&name=...`
- `GET /vault/documents?vaultId=...`
- `GET /vault/documents/:id/download`
- `DELETE /vault/documents/:id`

Todas estas requests usan:

```http
Authorization: Bearer <accessToken>
```

El cliente no agrega headers `x-zt-*`. Esos los agrega `zerotrust-api`.

## Politicas actuales de Zero Trust

Las reglas efectivas del MVP hoy son:

- `GET /documents...` requiere `MEMBER`
- `POST /documents...` requiere `ADMIN`
- `DELETE /documents...` requiere `ADMIN`
- el resto de rutas de `vault` requieren al menos `MEMBER`
- `OWNER` satisface reglas de `ADMIN` y `MEMBER`

Importante:

- Aunque existe `ZeroTrust/zerotrust-api/local/policies.json`, hoy las policies activas estan implementadas en codigo.

## Integracion recomendada en frontend

Secuencia:

1. Guardar `accessToken` y `refreshToken` en sesion segura.
2. Usar `accessToken` para llamar a `auth-api` y `zerotrust-api`.
3. Ante `401`, intentar `refresh`.
4. Si `refresh` falla, limpiar sesion y volver a login.

Variables sugeridas:

```env
AUTH_API_URL=http://localhost:3002/api
ZT_API_URL=http://localhost:3010
```

Ejemplo en TypeScript:

```ts
type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export async function login(input: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<TokenPair> {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  return res.json();
}

export async function getProfile(accessToken: string) {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Profile failed: ${res.status}`);
  }

  return res.json();
}

export async function listVaults(accessToken: string) {
  const res = await fetch(`${process.env.ZT_API_URL}/vault/vaults`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Vault list failed: ${res.status}`);
  }

  return res.json();
}
```

## Integracion recomendada en backend o BFF

Si tu proyecto expone un backend propio:

- haz login server-to-server o desde el frontend y persiste la sesion en cookies `httpOnly`
- no expongas `refreshToken` en storage inseguro del browser
- centraliza el refresh en tu BFF
- usa `accessToken` solo para llamar `auth-api` y `zerotrust-api`

## Integracion interna entre servicios

Si otro microservicio necesita consultar tenants o memberships desde `auth-api`, existen endpoints internos:

- `GET /api/internal/tenants/:id`
- `GET /api/internal/memberships/resolve?userId=...&tenantId=...`
- `GET /api/internal/users/:userId/tenants`

Estos endpoints:

- no son publicos
- requieren el header `x-internal-service-secret`

Ejemplo:

```http
GET /api/internal/memberships/resolve?userId=u1&tenantId=t1
x-internal-service-secret: <shared-secret>
```

Este flujo es para server-to-server. No debe usarse desde frontend.

## Smoke test manual

Login:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"123456","tenantSlug":"sentinel-labs"}'
```

Listar tenants via Zero Trust:

```bash
curl http://localhost:3010/vault/tenants \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Crear vault:

```bash
curl -X POST http://localhost:3010/vault/vaults \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mi Vault","slug":"mi-vault"}'
```

## Referencias en el repo

- `README.md`
- `auth/auth-api/README.md`
- `ZeroTrust/zerotrust-api/README.md`
- `securechain-vault/README.md`
- `sentinel-app/src/lib/server/auth-client.ts`
- `auth/auth-api/src/modules/auth/auth.service.ts`
- `ZeroTrust/zerotrust-api/src/modules/policy/policy.service.ts`
- `securechain-vault/vault-api/src/common/modules/auth-directory/auth-directory.service.ts`

## Resumen practico

- Login y refresh ocurren en `auth-api`.
- Toda operacion de Vault entra por `zerotrust-api`.
- `vault-api` no se consume directo desde clientes.
- Tenants y memberships viven en `auth-api`.
- Integraciones server-to-server con `auth-api` usan `x-internal-service-secret`.
