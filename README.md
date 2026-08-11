# Sytadel Suite

Monorepo con los servicios de Sytadel:

- `auth-api`: identidad, tenants, memberships y sesiones (submódulo)
- `zerotrust-api`: gateway Zero Trust que valida JWT, aplica policy y firma requests downstream (submódulo)
- `vault-api`: dominio de vaults, documentos, cifrado, auditoría, anclaje y notaría (submódulo)
- `billing-api`: metering + suscripciones (submódulo)
- `sytadel-web`: landing comercial en Astro
- `sytadel-app`: dashboard operativo en Next para Auth + Vault + Billing

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
- `billing-api`: [http://localhost:3020/api](http://localhost:3020/api)
- `sytadel-web`: [http://localhost:4321](http://localhost:4321)
- `sytadel-app`: [http://localhost:3003](http://localhost:3003)
- `minio`: [http://localhost:9001](http://localhost:9001)

Para bajar el stack:

```bash
docker compose down
```

Para bajar y borrar volúmenes:

```bash
docker compose down -v
```

## Secrets (JWT / HMAC compartidos)

Los secrets compartidos entre servicios se inyectan por variable de entorno; el
compose los interpola desde un `.env` en la raíz (auto-cargado, gitignoreado).
Sin `.env`, el stack arranca con defaults `dev-insecure-*` **solo aptos para
local/CI**. En cualquier entorno real, generá valores fuertes y ponelos en
`.env`:

```bash
cat > .env <<EOF
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
AUTH_JWT_REFRESH_SECRET=$(openssl rand -hex 32)
INTERNAL_SERVICE_SECRET=$(openssl rand -hex 32)
INTERNAL_HMAC_SECRET=$(openssl rand -hex 32)
BILLING_INTERNAL_SERVICE_SECRET=$(openssl rand -hex 32)
BILLING_INTERNAL_HMAC_SECRET=$(openssl rand -hex 32)
EOF
```

Cada variable es un secreto lógico único: un mismo valor alimenta a todos los
servicios que lo comparten (p. ej. `JWT_ACCESS_SECRET` lo usa auth para firmar y
zerotrust/billing para verificar), así no pueden desincronizarse. Verificá la
interpolación con `docker compose config`.

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

## Smoke tests

Con el stack levantado:

```bash
./scripts/smoke.sh          # flujo auth → zerotrust → vault (docs)
./scripts/notary-smoke.sh   # flujo notaría vía vault-api
node scripts/validate-metering.js   # sanity de la pipeline de billing
```

`smoke.sh` valida:

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

- [auth/auth-api/README.md](./auth/auth-api/README.md)
- [ZeroTrust/zerotrust-api/README.md](./ZeroTrust/zerotrust-api/README.md)
- [securechain-vault/README.md](./securechain-vault/README.md)
- [billing/billing-api/](./billing/billing-api/)
- [sytadel-app/README.md](./sytadel-app/README.md)
- [sytadel-web/README.md](./sytadel-web/README.md)

## Paquete de documentación integral

Documentación estratégica y técnica de producto:
- [Roadmap](./docs/ROADMAP.md)
- [docs/architecture/README.md](./docs/architecture/README.md)
- [Documento maestro de Sytadel](./docs/architecture/sytadel-master-es.md)
