# Sytadel Auth API: guia de integracion para otros proyectos

Esta documentacion explica como integrar `auth-api` de Sytadel desde un proyecto externo, ya sea una web propia, un backend/BFF o una integracion maquina-a-maquina.

## Que es `auth-api`

`auth-api` es el servicio de identidad y directorio multi-tenant de la plataforma. Es la fuente de verdad para:

- usuarios
- tenants
- memberships por tenant
- sesiones
- refresh token rotation
- entitlements efectivos del tenant
- integraciones por `client apps` y `service accounts`

## Cuando conviene usarlo

Usa `auth-api` si tu proyecto necesita:

- autenticar usuarios humanos con email y password
- operar en contexto de tenant
- conocer el rol del usuario dentro de un tenant
- mantener sesiones con `accessToken` y `refreshToken`
- emitir tokens para integraciones backend mediante `service accounts`

No lo integres como si hoy fuera un proveedor OAuth2/OIDC completo tipo Auth0 u Okta.

## Limitaciones actuales

Hoy el servicio expone una API propia, no una plataforma OIDC completa. En el estado actual:

- no hay `/.well-known/openid-configuration`
- no hay `authorization_code`
- no hay PKCE
- no hay JWKS publico
- no hay SSO/SAML/OIDC enterprise

La integracion recomendada hoy es por API HTTP directa.

## URLs base

Hay una diferencia importante entre el puerto interno del servicio y el puerto publicado en el stack local:

- dentro de Docker y entre servicios: `http://auth-api:3001/api`
- desde tu maquina local usando el `docker-compose.yml` raiz: `http://localhost:3002/api`
- en desarrollo standalone, si no defines `PORT`, el servicio arranca en `3001`

Variables sugeridas en un proyecto externo:

```env
AUTH_API_URL=http://localhost:3002/api
```

## Modelo mental de integracion

### Opcion 1: usuarios humanos

Flujo recomendado:

1. Tu frontend o BFF hace `POST /auth/login`.
2. Recibe `accessToken` y `refreshToken`.
3. Consulta `GET /auth/me` para resolver usuario, tenant, roles y entitlements.
4. Usa el `accessToken` como `Bearer` para llamadas autenticadas.
5. Ante `401`, intenta `POST /auth/refresh`.
6. Si `refresh` falla, cierra sesion y vuelve a login.

### Opcion 2: integracion backend-to-backend

Flujo recomendado:

1. Un admin del tenant crea una `client app`.
2. Dentro de esa app crea una `service account`.
3. Tu backend guarda el `clientSecret` en un secreto seguro.
4. Tu backend pide un token a `POST /integrations/service-account-token`.
5. Usa el `accessToken` retornado como `Bearer`.

## Endpoints principales

Todos los paths de esta guia se expresan relativos a `AUTH_API_URL`.

### 1. Login

`POST /auth/login`

Request:

```json
{
  "email": "admin@test.com",
  "password": "123456",
  "tenantSlug": "sentinel-labs"
}
```

Tambien puedes enviar `tenantId` en lugar de `tenantSlug`.

Reglas importantes:

- `email` debe ser valido
- `password` requiere minimo 6 caracteres
- debes enviar `tenantId` o `tenantSlug`
- el usuario debe tener membership activa en ese tenant
- si el tenant esta inactivo, solo `OWNER` puede ingresar

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

### 2. Perfil de sesion

`GET /auth/me`

Headers:

```http
Authorization: Bearer <accessToken>
```

Response tipica:

```json
{
  "user": {
    "id": "user-id",
    "email": "admin@test.com",
    "firstName": "Ada",
    "lastName": "Lovelace"
  },
  "tenant": {
    "id": "tenant-id",
    "name": "Sentinel Labs",
    "slug": "sentinel-labs",
    "planCode": "PRO",
    "billingBypass": false,
    "entitlements": {
      "planCode": "PRO",
      "features": {
        "apiAuth": true
      },
      "limits": {
        "maxUsers": 25
      }
    }
  },
  "roles": ["OWNER"],
  "sessionId": "session-id"
}
```

Este endpoint es la forma recomendada de inicializar tu sesion en el proyecto integrador.

### 3. Refresh de sesion

`POST /auth/refresh`

Request:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Response:

```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

Notas:

- el refresh token es rotativo
- no debes reutilizar refresh tokens viejos
- si el servicio detecta reuse de un refresh viejo, invalida la familia de sesion

### 4. Logout de la sesion actual

`POST /auth/logout`

Puedes cerrar sesion con una de estas dos variantes:

Por refresh token:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Por `sessionId`:

```json
{
  "sessionId": "<session-id>"
}
```

### 5. Logout de todas las sesiones

`POST /auth/logout-all`

Headers:

```http
Authorization: Bearer <accessToken>
```

Esto revoca todas las sesiones activas del usuario.

## JWT emitido por `auth-api`

Configuracion actual:

- algoritmo: `HS256`
- issuer por defecto: `auth`
- audience por defecto: `zerotrust-api`
- expiracion de access token por defecto: `15m`
- expiracion de refresh token por defecto: `7d`

Claims relevantes del access token:

- `sub`: id del usuario o actor
- `tenantId`: tenant actual
- `roles`: roles efectivos
- `sessionId`: id de sesion
- `type`: siempre `access`
- `actorType`: puede ser `user` o `service_account`
- `clientAppId`: presente en tokens de service account
- `serviceAccountId`: presente en tokens de service account

## Integracion recomendada para frontend o BFF

Recomendaciones practicas:

- guarda el `refreshToken` en cookie `httpOnly` si tienes BFF
- evita persistir `refreshToken` en `localStorage`
- usa `GET /auth/me` despues del login para poblar tu estado de sesion
- refresca el token centralizadamente
- si recibes `401` y el refresh tambien falla, destruye sesion

Ejemplo basico en TypeScript:

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

export async function getSession(accessToken: string) {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Session lookup failed: ${res.status}`);
  }

  return res.json();
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`);
  }

  return res.json();
}
```

## Administracion de tenants, usuarios y memberships

Estos endpoints sirven si tu proyecto externo tambien va a administrar identidad, no solo consumir login.

### Crear tenant

`POST /tenants`

Requiere `Authorization: Bearer <accessToken>`.

Request minima:

```json
{
  "name": "Acme Legal",
  "slug": "acme-legal"
}
```

Comportamiento:

- crea el tenant
- agrega automaticamente al usuario autenticado como `OWNER`

### Consultar tenant

`GET /tenants/:id`

Roles permitidos:

- `OWNER`
- `ADMIN`
- `MEMBER`

### Actualizar tenant

`PATCH /tenants/:id`

Rol permitido:

- `OWNER`

Campos actualizables relevantes:

- `name`
- `slug`
- `planCode`
- `isActive`
- `ztPoliciesEnabled`
- `vaultsEnabled`
- `maxVaults`
- `maxUsers`
- `monthlyNotaryRequests`
- `auditRetentionDays`
- `maxClientApps`
- `maxServiceAccounts`
- `apiAddons`
- `billingBypass`

### Crear usuario

`POST /users`

Roles permitidos:

- `OWNER`
- `ADMIN`

Request:

```json
{
  "email": "operator@acme.com",
  "password": "supersecret",
  "firstName": "Ana",
  "lastName": "Lopez"
}
```

### Asignar membership a un tenant

`POST /memberships`

Roles permitidos:

- `OWNER`
- `ADMIN`

Request:

```json
{
  "userId": "user-id",
  "tenantId": "tenant-id",
  "role": "MEMBER"
}
```

Roles validos:

- `OWNER`
- `ADMIN`
- `MEMBER`

## Integraciones por client apps y service accounts

Este es el flujo correcto para integraciones sin usuario humano logueado.

Importante:

- el tenant debe tener habilitado el feature `apiAuth`
- solo `OWNER` y `ADMIN` pueden administrar estas credenciales

### 1. Listar client apps del tenant

`GET /tenants/:tenantId/client-apps`

### 2. Crear client app

`POST /tenants/:tenantId/client-apps`

Request:

```json
{
  "name": "ERP Externo",
  "slug": "erp-externo",
  "description": "Integracion backend con sistema tercero"
}
```

Reglas:

- `slug` debe cumplir `^[a-z0-9-]+$`
- si el tenant tiene cupo configurado y ya lo alcanzo, la API responde `403`
- el `slug` debe ser unico dentro del tenant

### 3. Crear service account

`POST /tenants/:tenantId/client-apps/:clientAppId/service-accounts`

Request:

```json
{
  "name": "worker-sync-nocturno",
  "description": "Job de sincronizacion"
}
```

Response:

```json
{
  "serviceAccount": {
    "id": "service-account-id",
    "name": "worker-sync-nocturno",
    "isActive": true
  },
  "clientSecret": "<secret-plano>"
}
```

Atencion:

- el `clientSecret` solo debe guardarse una vez en un vault o secret manager
- si lo pierdes, debes rotarlo

### 4. Rotar secret

`POST /tenants/:tenantId/service-accounts/:serviceAccountId/rotate-secret`

Response:

```json
{
  "serviceAccount": {
    "id": "service-account-id"
  },
  "clientSecret": "<new-secret>"
}
```

### 5. Emitir token para service account

`POST /integrations/service-account-token`

Request:

```json
{
  "tenantSlug": "sentinel-labs",
  "clientAppId": "client-app-id",
  "serviceAccountId": "service-account-id",
  "clientSecret": "<secret>"
}
```

Tambien puedes enviar `tenantId` en lugar de `tenantSlug`.

Response:

```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "tokenType": "Bearer",
  "tenant": {
    "id": "tenant-id",
    "slug": "sentinel-labs",
    "name": "Sentinel Labs"
  },
  "clientApp": {
    "id": "client-app-id",
    "name": "ERP Externo",
    "slug": "erp-externo"
  },
  "serviceAccount": {
    "id": "service-account-id",
    "name": "worker-sync-nocturno"
  }
}
```

Notas:

- este flujo devuelve solo `accessToken`, no `refreshToken`
- el token sale con rol `API_CLIENT`
- si el tenant, la app o la cuenta estan inactivos, la API rechaza la emision
- si las credenciales son invalidas, la respuesta es `401`

## Endpoints internos server-to-server

Estos endpoints son para otros servicios de la plataforma, no para frontend publico.

Base relativa: `/internal`

Disponibles:

- `GET /internal/tenants/:id`
- `GET /internal/tenants/:id/entitlements`
- `PATCH /internal/tenants/:id`
- `GET /internal/memberships/resolve?userId=...&tenantId=...`
- `GET /internal/users/:userId/tenants`

Proteccion:

- requieren el guard interno del servicio
- en la documentacion existente del repo se usan con secreto compartido
- deben tratarse como superficie privada

## Manejo recomendado de errores

Codigos esperables mas comunes:

- `401 Unauthorized`: credenciales invalidas, token vencido, refresh invalido, membership ausente
- `403 Forbidden`: el tenant no tiene habilitado el pack requerido o el rol no alcanza
- `404 Not Found`: tenant, membership, app o service account inexistente
- `409 Conflict`: slug duplicado de `client app`

Recomendacion de integracion:

- ante `401` en endpoints autenticados, intenta refresh una sola vez
- si el refresh falla, limpia sesion
- no reintentes ciegamente `service-account-token` si el secreto es invalido

## Smoke test rapido

Login:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H 'content-type: application/json' \
  -d '{
    "email":"admin@test.com",
    "password":"123456",
    "tenantSlug":"sentinel-labs"
  }'
```

Perfil:

```bash
curl http://localhost:3002/api/auth/me \
  -H 'authorization: Bearer <accessToken>'
```

Refresh:

```bash
curl -X POST http://localhost:3002/api/auth/refresh \
  -H 'content-type: application/json' \
  -d '{
    "refreshToken":"<refreshToken>"
  }'
```

## Datos demo del stack local

Si `AUTH_BOOTSTRAP_DEMO_DATA=true`, el servicio crea automaticamente:

- tenant `sentinel-labs`
- usuario `admin@test.com`
- password `123456`
- membership `OWNER`

## Recomendacion final

Si tu proyecto externo necesita solo autenticacion humana, empieza con:

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Si ademas necesitas procesos automáticos o integracion entre backends, suma:

- `POST /tenants/:tenantId/client-apps`
- `POST /tenants/:tenantId/client-apps/:clientAppId/service-accounts`
- `POST /integrations/service-account-token`

Ese es hoy el contrato mas estable y soportado de `Sytadel auth-api` en este repositorio.
