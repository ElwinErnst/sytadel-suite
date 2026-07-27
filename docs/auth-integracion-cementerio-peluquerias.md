# Integracion de Auth para sistema de cementerio y sistema de peluquerias

Esta guia describe como integrar un software externo con `auth-api` de Sentinel en dos escenarios concretos:

- un sistema de cementerio con operadores, administradores y acceso por sucursal o tenant
- un sistema de peluquerias con recepcion, caja, administracion y posible integracion backend

La idea es usar `auth-api` como autoridad de identidad y tenancy, y usar `zerotrust-api` como puerta de acceso a APIs protegidas cuando el sistema externo necesite hablar con servicios operativos de Sentinel.

## Objetivo

Permitir que un software externo:

- autentique usuarios humanos
- mantenga sesion con `accessToken` + `refreshToken`
- obtenga contexto del tenant actual
- use service accounts para integraciones maquina-a-maquina cuando haga falta

## Que soporta hoy el stack

Hoy `auth-api` soporta:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- gestion de `client apps`
- gestion de `service accounts`
- emision de JWT Bearer para consumo interno de la plataforma

Esto alcanza para integrar software propio o software de terceros controlado por ustedes.

Importante:

- hoy no existe un proveedor OAuth2 / OpenID Connect completo
- no hay `/.well-known/openid-configuration`
- no hay flujo `authorization_code`
- no hay PKCE
- no hay JWKS publico

Por lo tanto, la integracion recomendada hoy es por API directa contra `auth-api`, no como si fuera Auth0, Okta o Google Identity.

## Arquitectura recomendada

### Opcion 1: frontend o app del sistema externo

Usar esta opcion si el sistema de cementerio o peluquerias tiene:

- web app propia
- panel administrativo
- app interna de empleados

Flujo:

1. El usuario inicia sesion contra `auth-api`.
2. El sistema externo guarda el `accessToken` y el `refreshToken` en una sesion segura.
3. El sistema externo consulta `GET /auth/me` para obtener usuario, tenant y roles.
4. Cuando necesite consumir APIs protegidas de Sentinel, usa el `accessToken`.
5. Si recibe `401`, intenta `refresh`.

### Opcion 2: backend-to-backend

Usar esta opcion si el sistema externo necesita:

- sincronizar clientes
- emitir documentos
- consultar registros desde jobs o procesos automáticos
- integrar una API del software de cementerio o peluqueria con Sentinel sin usuario humano logueado

Flujo:

1. Un administrador crea una `client app`.
2. Dentro de esa app crea una `service account`.
3. El backend externo pide token en `POST /integrations/service-account-token`.
4. Usa el `accessToken` recibido como Bearer token.

## Modelo recomendado para cementerio y peluquerias

En ambos casos conviene mapear cada negocio o unidad operativa a un tenant.

### Sistema de cementerio

Recomendacion:

- un tenant por empresa operadora o por parque cementerio, segun el modelo comercial
- usuarios con membership por tenant
- roles sugeridos: `OWNER`, `ADMIN`, `MEMBER`

Ejemplo de uso:

- `OWNER`: dueño del parque o administrador principal
- `ADMIN`: supervisores, administración, caja, ventas, documentación
- `MEMBER`: operadores con acceso operativo limitado

### Sistema de peluquerias

Recomendacion:

- un tenant por cadena, franquicia o salon, segun el nivel de aislamiento que necesiten
- si quieren separar sucursales con mucha independencia, usar un tenant por sucursal
- si quieren operar varias sucursales bajo una misma cuenta comercial, usar un tenant por marca y manejar sucursales como dato de negocio en el software externo

Ejemplo de uso:

- `OWNER`: dueño de la peluqueria o franquicia
- `ADMIN`: gerencia, encargados, caja
- `MEMBER`: estilistas, recepción u operadores

## URLs base

Ejemplo local:

```env
AUTH_API_URL=http://localhost:3002/api
ZT_API_URL=http://localhost:3010
```

En produccion deben reemplazarse por las URLs reales publicadas por la plataforma.

## Integracion para usuarios humanos

### 1. Login

Request:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@cementerio.com",
  "password": "super-secret",
  "tenantSlug": "cementerio-central"
}
```

Tambien puede usarse `tenantId`.

Response esperada:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<refresh-token>",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

Notas:

- el usuario debe tener membership activa en ese tenant
- si el usuario pertenece a varios tenants, el sistema externo debe enviar el tenant correcto al loguear

### 2. Perfil actual

Request:

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

Response esperada:

```json
{
  "user": {
    "id": "u_123",
    "email": "admin@cementerio.com",
    "firstName": "Ana",
    "lastName": "Lopez"
  },
  "tenant": {
    "id": "t_123",
    "name": "Cementerio Central",
    "slug": "cementerio-central",
    "planCode": "pro",
    "billingBypass": false,
    "entitlements": {
      "features": {
        "apiAuth": true
      }
    }
  },
  "roles": ["ADMIN"],
  "sessionId": "session_123"
}
```

Este endpoint sirve para:

- cargar el contexto del usuario autenticado
- saber en que tenant esta operando
- adaptar menus, permisos y pantallas segun rol

### 3. Refresh de sesion

Request:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh-token>"
}
```

El refresh token es rotativo. Cada refresh devuelve un nuevo par de tokens.

### 4. Logout

Request:

```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "<refresh-token>"
}
```

Tambien puede cerrarse por `sessionId`.

## Integracion backend-to-backend con service accounts

Esta es la opcion recomendada si el sistema de cementerio o peluquerias tiene:

- procesos batch
- jobs de sincronizacion
- integraciones nocturnas
- middleware propio
- un BFF que no quiere depender de una sesion humana

### 1. Crear client app

Un admin del tenant crea la app cliente:

```http
POST /tenants/:tenantId/client-apps
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{
  "name": "Integracion Cementerio ERP",
  "slug": "cementerio-erp",
  "description": "Integracion backend con sistema operativo del cementerio"
}
```

Para peluquerias:

```json
{
  "name": "Integracion Peluquerias POS",
  "slug": "peluquerias-pos",
  "description": "Sincronizacion de turnos, caja y clientes"
}
```

### 2. Crear service account

```http
POST /tenants/:tenantId/client-apps/:clientAppId/service-accounts
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{
  "name": "Produccion",
  "description": "Cuenta tecnica para backend productivo"
}
```

Response:

```json
{
  "serviceAccount": {
    "id": "<service-account-id>",
    "name": "Produccion"
  },
  "clientSecret": "<secret>"
}
```

El `clientSecret` debe guardarse de inmediato en un secreto seguro del sistema externo.

### 3. Emitir token tecnico

```http
POST /integrations/service-account-token
Content-Type: application/json

{
  "tenantSlug": "cementerio-central",
  "clientAppId": "<client-app-id>",
  "serviceAccountId": "<service-account-id>",
  "clientSecret": "<secret>"
}
```

Response:

```json
{
  "accessToken": "<jwt>",
  "accessTokenExpiresIn": 900,
  "tokenType": "Bearer",
  "tenant": {
    "id": "<tenant-id>",
    "slug": "cementerio-central",
    "name": "Cementerio Central"
  },
  "clientApp": {
    "id": "<client-app-id>",
    "slug": "cementerio-erp",
    "name": "Integracion Cementerio ERP"
  },
  "serviceAccount": {
    "id": "<service-account-id>",
    "name": "Produccion"
  }
}
```

### 4. Consumir APIs protegidas

Luego el backend externo usa:

```http
Authorization: Bearer <accessToken>
```

Si el flujo pasa por Sentinel, la recomendacion actual es consumir `zerotrust-api` y no hablar directo con `vault-api`.

## Ejemplo de implementacion en Node.js

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

export async function me(accessToken: string) {
  const res = await fetch(`${process.env.AUTH_API_URL}/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Profile failed: ${res.status}`);
  }

  return res.json();
}
```

Ejemplo backend-to-backend:

```ts
type ServiceAccountToken = {
  accessToken: string;
  accessTokenExpiresIn: number;
  tokenType: 'Bearer';
};

export async function issueServiceAccountToken() {
  const res = await fetch(
    `${process.env.AUTH_API_URL}/integrations/service-account-token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: process.env.AUTH_TENANT_SLUG,
        clientAppId: process.env.AUTH_CLIENT_APP_ID,
        serviceAccountId: process.env.AUTH_SERVICE_ACCOUNT_ID,
        clientSecret: process.env.AUTH_CLIENT_SECRET,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Token issuance failed: ${res.status}`);
  }

  return (await res.json()) as ServiceAccountToken;
}
```

## Recomendaciones por tipo de sistema

### Cementerio

Recomendado:

- usar login humano para administración, documentación, ventas y caja
- usar service account para sincronizaciones con ERP, CRM o procesos documentales
- separar ambientes por tenant si administran varias unidades operativas con aislamiento fuerte

### Peluquerias

Recomendado:

- usar login humano para recepcionistas, estilistas, caja y administración
- usar service account para sincronizar turnos, clientes, catálogo, caja o facturación con sistemas externos
- definir temprano si cada sucursal sera tenant propio o si varias sucursales compartirán tenant

## Buenas practicas

- guardar `refreshToken` en cookie `httpOnly` o almacenamiento seguro del backend
- no exponer `clientSecret` en frontend
- no llamar `vault-api` directo desde sistemas externos
- centralizar refresh en un BFF cuando sea posible
- rotar secretos de service accounts en forma periódica
- usar un tenant por frontera comercial o de aislamiento real, no por capricho técnico

## Limitaciones actuales

Antes de vender esta integracion como producto de autenticacion general, hay que tener en cuenta:

- no hay SSO empresarial via OIDC o SAML
- no hay MFA
- no hay password reset ni email verification maduros
- el flujo machine-to-machine actual es propio, no OAuth `client_credentials`
- los JWT actuales estan orientados al ecosistema Sentinel

Esto no bloquea integrar un sistema de cementerio o peluquerias propio.
Si bloquea, en cambio, pretender compatibilidad inmediata con software de terceros que espere un IdP estándar.

## Checklist minimo de puesta en marcha

1. Crear tenant para el negocio o la unidad operativa.
2. Crear usuarios y memberships.
3. Definir si el acceso sera humano, backend o mixto.
4. Si hay integracion backend, crear `client app` y `service account`.
5. Configurar variables de entorno del sistema externo.
6. Implementar login, refresh y lectura de `me`.
7. Probar consumo de APIs protegidas con Bearer token.
8. Definir politica de rotacion de secretos y manejo de sesiones.

## Variables sugeridas para el sistema externo

```env
AUTH_API_URL=https://auth.tu-dominio.com/api
ZT_API_URL=https://zt.tu-dominio.com

AUTH_TENANT_SLUG=cementerio-central
AUTH_CLIENT_APP_ID=
AUTH_SERVICE_ACCOUNT_ID=
AUTH_CLIENT_SECRET=
```

## Siguiente evolucion recomendada

Si la meta es que estos sistemas se integren como clientes externos mas estandarizados, la hoja de ruta recomendada es:

1. agregar JWT asimetrico y JWKS
2. agregar discovery `/.well-known`
3. implementar `client_credentials`
4. implementar OIDC `authorization_code` + PKCE
5. agregar scopes y audiencias por app
6. sumar MFA y lifecycle de cuenta
