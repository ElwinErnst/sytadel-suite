# Sentinel Suite

Monorepo con tres servicios principales:

- `auth-api`: identidad, tenants, memberships y sesiones
- `zerotrust-api`: gateway Zero Trust que valida JWT, aplica policy y firma requests downstream
- `vault-api`: dominio de vaults, documentos, cifrado, auditoría y anclaje

## Estado actual

El flujo principal ya está validado end to end:

1. `auth-api` autentica al usuario y emite JWT
2. `zerotrust-api` valida el token y aplica policy
3. `vault-api` acepta sólo requests firmadas por Zero Trust
4. `vault-api` resuelve tenants y memberships desde `auth-api`

Decisión vigente:

- `auth-api` es la fuente de verdad de `tenants` y `memberships`
- `vault-api` ya no crea tenants y consume ese directorio vía llamadas internas a `auth-api`
- `vault-api` mantiene `tenant_id` como dato de dominio, pero ya no depende de foreign keys locales hacia la tabla `tenants`

## Arranque con Docker

Desde la raíz:

```bash
docker compose up --build
```

Servicios expuestos:

- `auth-api`: [http://localhost:3002/api](http://localhost:3002/api)
- `vault-api`: [http://localhost:3000](http://localhost:3000)
- `zerotrust-api`: [http://localhost:3010](http://localhost:3010)
- `minio`: [http://localhost:9001](http://localhost:9001)

Para bajar el stack:

```bash
docker compose down
```

Para bajar y borrar volúmenes:

```bash
docker compose down -v
```

## Demo local

Con `AUTH_BOOTSTRAP_DEMO_DATA=true`, `auth-api` inicializa:

- tenant `sentinel-labs`
- user `admin@test.com`
- password `123456`
- membership `OWNER`

## Smoke test manual

Login:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"123456","tenantSlug":"sentinel-labs"}'
```

Luego usar el `accessToken` contra Zero Trust:

```bash
curl http://localhost:3010/vault/tenants \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Resultado esperado:

- `GET /vault/tenants` devuelve `200 OK`
- `POST /vault/tenants` devuelve `409 Conflict`, porque la creación de tenants pertenece a `auth-api`

## Smoke test

Con el stack levantado:

```bash
./scripts/smoke.sh
```

El script valida:

- login en `auth-api`
- `GET /vault/tenants` vía `zerotrust-api`
- `POST /vault/tenants` bloqueado en `vault-api`
- creación y listado básico de un vault vía `zerotrust-api`
- upload, listado, download y cleanup de un documento vía `zerotrust-api`
- cleanup final del vault creado para no dejar residuo

## Notas operativas

- El gateway Zero Trust expone `vault-api` bajo el prefijo `/vault`
- El bucket `vault` de MinIO se crea automáticamente al levantar el stack
- La imagen local publica `auth-api` en `3002` porque `3001` estaba ocupado en el entorno de desarrollo donde se armó el stack

## Documentación por servicio

- [auth/auth-api/README.md](/Users/sasha/Proyects/sentinel-suite/auth/auth-api/README.md)
- [ZeroTrust/zerotrust-api/README.md](/Users/sasha/Proyects/sentinel-suite/ZeroTrust/zerotrust-api/README.md)
- [securechain-vault/README.md](/Users/sasha/Proyects/sentinel-suite/securechain-vault/README.md)
