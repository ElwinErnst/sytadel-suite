# Sytadel — Secure Agentic Platform Roadmap

## Objetivo del producto

**Construir Sytadel como una PaaS segura y un plano de control para equipos que
crean software y automatizaciones con agentes de IA.** Sytadel debe abstraer
identidad y tenancy, políticas, secretos y Vault, auditoría/notaría
tamper-evident, Billing y entitlements, identidad de agentes, MCP y aprobación
humana de acciones consecuentes, para que cada equipo pueda enfocarse en sus
reglas de negocio.

La suite actual contiene servicios y capacidades funcionales que forman una
base para ese objetivo; no es todavía un runtime alojado completo para agentes.
Este roadmap separa explícitamente lo implementado de la arquitectura objetivo
y sus brechas de producto.

## Cómo leer este roadmap

Tres tracks paralelos para llevar la base actual hacia el producto objetivo:

- **Platform foundation (Q3-Q4 2026)** — completar y demostrar controles de confianza reutilizables.
- **Operational hardening (Q4 2026, en paralelo)** — mejorar seguridad y confiabilidad de los componentes actuales.
- **Product maturity (2027+)** — cerrar brechas necesarias para ofrecer una plataforma operable por equipos externos.

Estados: **✅ Hecho** | **🟡 En curso** | **⏭️ Próximo** | **🔮 Después** | **❌ Descartado**

---

## Prerequisitos (bloqueadores antes de arrancar M1)

Sin esto, el resto del roadmap no tiene dónde apoyarse:

- **✅ Repos públicos** — los 5 (meta + 4 submódulos) son PUBLIC en `github.com/ElwinErnst/*`. Historia auditada, `security-assessment.docx` y email de contributor externo sanitizados con `git filter-repo`
- **✅ Landing pública en `sytadel-labs.com`** — deployada en Vercel apuntando a `sentinel-web`. Topbar + footer linkean al repo público del meta
- **✅ Estructura mínima corriendo** — auth, RBAC, vaults, documents, tenants, billing están funcionales y verificados con smoke tests

**Estado de base:** la landing pública presenta capacidades actuales y permite explorar una demo limitada. Esto demuestra componentes existentes; no acredita una plataforma operativa completa ni un runtime alojado de agentes.

---

## Platform foundation track (Q3-Q4 2026)

### M1 — Fundamentos de seguridad modernos (semanas 1-3)

**Platform outcome:** demostrar identidad, aislamiento por tenant, evidencia tamper-evident y límites de acceso reutilizables.

| Feature | Estado | Notas |
|---------|--------|-------|
| **Passkeys / WebAuthn** | ✅ | Backend (`auth-api/modules/passkeys/`) + frontend (`sentinel-app` login + settings). Coexistencia password+passkey, multi-device, user-enumeration-resistant. |
| **Tamper-evident audit log** | ✅ | `vault-api/audit-hash.util` + `audit.interceptor`. Bench: 205 writes/sec, verify 3238 rows en ~100ms. Race del `(scope, seq)` detectado y arreglado con `pg_advisory_xact_lock`. |
| **Session anomaly detection** | ✅ | `auth-api/modules/session-anomaly/`: score por IP + país (geoip-lite) + coarse UA fingerprint. Smoke: login desde JP con IP fresca dispara `critical` (score 70). |
| **Automated secret rotation** | ✅ | `auth-api/modules/integrations/secret-rotation.cron.ts` + endpoint `/rotation-policy`. Overlap 24h con `previousSecretHash`. Smoke verificado end-to-end: rotate → new+old ambos válidos durante grace → old rechazado post-grace. |

**Blog posts publicados en el repo** (`docs/blog/`), listos para dev.to + Medium + LinkedIn:
- [`2026-07-tamper-evident-audit-log-nestjs.md`](./blog/2026-07-tamper-evident-audit-log-nestjs.md)
- [`2026-07-webauthn-nestjs-nextjs.md`](./blog/2026-07-webauthn-nestjs-nextjs.md)
- [`2026-07-session-anomaly-detection.md`](./blog/2026-07-session-anomaly-detection.md)
- [`2026-07-automated-secret-rotation.md`](./blog/2026-07-automated-secret-rotation.md)

**M1 cerrado.** Conservar resultados de pruebas y decisiones como evidencia de las capacidades actuales.

### M2 — Capa AI-powered de seguridad (semanas 4-7)

**Platform outcome:** mantener las capacidades de IA medibles, acotadas y subordinadas al enforcement determinista.

| Feature | Estado | Notas |
|---------|--------|-------|
| **LLM anomaly classifier** | ✅ | End-to-end en producción. Pipeline async: analyzer heurístico → `ANOMALY_PERSISTED_EVENT` (EventEmitter2) → listener → Claude Sonnet 5 con structured output → persiste en `session_anomaly_classifications`. Verificado: login desde IP fresca disparó `suspicious` con confidence 0.60 → `step_up_auth`, 3.7s. **Evals sobre 25 fixtures: accuracy 95.7%, critical class precision 1.00 / recall 1.00, cost $0.00506/análisis, p50 4s / p95 8.7s.** Blog post: [`2026-08-llm-anomaly-classifier.md`](./blog/2026-08-llm-anomaly-classifier.md). Diseño: [`architecture/m2-llm-anomaly-classifier.md`](./architecture/m2-llm-anomaly-classifier.md) |
| **Natural language → RBAC policy generator** | ✅ | LLM-as-compiler live en `zerotrust-api/modules/policy-generator/` + engine live que evalúa las policies en el gateway (`policy-evaluator.ts` puro + `PolicyService.decide()`). El generador expone `POST /policies/generate` (guarded OWNER/ADMIN); la **persistencia y administración se movieron a auth-api** (ver hardening track → "Admin de policies Zero Trust por tenant"): el `PolicyStoreService` in-memory y los endpoints `PUT/GET/DELETE /policies/:tenantId` de ZT fueron **retirados**. **Evals sobre 8 fixtures × 34 expectations: 6/8 fixtures OK, 30/34 expectations (88.2%), 0 errores de generación, $0.00790/gen, p50 3.1s / p95 7.4s.** Blog post: [`2026-08-nl-to-rbac-policy-generator.md`](./blog/2026-08-nl-to-rbac-policy-generator.md) |
| **AI-driven access review** | ✅ | Módulo `auth-api/modules/access-review/` con snapshot collector (users, memberships, service accounts, passkeys, sessions, anomalies), Claude Sonnet 5 con structured output y reporte markdown + recommendations enum-typed, endpoint `POST /tenants/:t/access-review/run` + `GET /latest` + `GET /history` (OWNER/ADMIN gated), cron nightly configurable (default 03:15 UTC). **Evals sobre 5 fixtures × 8 expectations: 5/5 fixtures OK, 8/8 expectations, 0 errores, $0.01476/review, p50 8.6s / p95 11.6s.** Live smoke: 7 recommendations grounded en snapshot real (dormant SAs, OWNER sin passkey + anomaly critical, SA con failed auth). Blog post: [`2026-08-ai-driven-access-review.md`](./blog/2026-08-ai-driven-access-review.md) |

**Decisiones técnicas clave:**
- Modelo principal: Claude Sonnet 5 vía API (cost-effective, structured output)
- Opción secundaria: modelo local (Llama 3 vía Ollama) — angle "data residency" para EU/regulated
- **Evals obligatorios:** dataset propio de 20-30 casos etiquetados, precision/recall reportados. Sin evals, un feature con LLM es "un juguete"

**Evidencia a conservar:** evaluaciones y metodología; precision/recall del clasificador, generador de políticas y access review; costo por análisis, latencia p95 y promedio de tokens por consulta.

### M3 — MCP + Agentic (semanas 8-11)

**Platform outcome:** expose existing identity/access operations through typed MCP tools, with explicit human-approval boundaries.

| Feature | Estado | Notas |
|---------|--------|-------|
| **Sytadel MCP server** | ✅ | Submódulo público [`ElwinErnst/sytadel-mcp-server`](https://github.com/ElwinErnst/sytadel-mcp-server) con 5 tools (`list_tenant_users`, `list_service_accounts`, `query_session_anomalies`, `generate_policy`, `run_access_review`). Dual-mode auth (user password / service account) para separar admin scope de API_CLIENT scope. Stdio transport, JWT cache con inflight coalescing, native fetch (zero third-party HTTP). Smoke real: 5/5 tools contra el docker stack, `run_access_review` devolvió 10.4KB con 8 recommendations en ~18s. Blog post: [`2026-08-mcp-server-identity-infrastructure.md`](./blog/2026-08-mcp-server-identity-infrastructure.md) |
| **Agentic approval workflow con HITL** | ✅ | Request de acceso → agente LangGraph (Claude) propone allow/deny con reasoning + confidence → OWNER/ADMIN aprueba (aplica la membership) o rechaza. El agente solo PROPONE; el humano decide. Contexto reusa el access-review snapshot. Degrada sin bloquear si el agente falla/está deshabilitado. 8/8 unit tests, agente verificado end-to-end. Submódulo `auth/auth-api`, módulo `access-request` |
| **Product demo with interactive preview** | ✅ | Consola "Try it" embebida en `sytadel-web`: el visitante chatea y Claude usa los mismos tools que expone el MCP server, sobre un tenant demo read-only con fixtures. "Click and try" real: sin instalar, sin cuenta, sin login. Nota: el "Connect al Claude Desktop de un click" no es factible para un MCP de terceros (no hay deep-link de auto-install estándar + necesita credenciales); la demo in-browser cumple la intención sin esos bloqueos, y deja abierto el connector remoto a futuro. Sitio estático + una función serverless (`api/demo.ts`), API key server-side, degradación elegante fuera de Vercel |

**Decisiones técnicas clave:**
- MCP server en TypeScript con SDK oficial de Anthropic
- Documentar en README cómo conectar desde Claude Desktop y desde Cursor (con screenshots)
- No reinventar el orquestador — usar LangGraph JS o similar. Foco en prompt design y diseño de tools

**Evidencia a conservar:** inventario de herramientas, latencia de extremo a extremo para request → approval y evaluación de recomendaciones del agente frente a decisiones humanas. Publicar un paquete o artículo es opcional y no define la madurez del producto.

---

## Operational hardening track (Q4 2026, en paralelo)

Priorizar la reducción de riesgos operativos y el cierre de brechas de seguridad en los componentes actuales, en paralelo con la evolución del producto.

- **✅ Rotar defaults `change-me-*` del compose** — M1 automated rotation cubrió las credenciales de service accounts. Los 6 HMAC/JWT secrets compartidos ya no están hardcodeados: el compose los interpola vía `${VAR:-dev-insecure-*}`, un único var por secreto lógico (los compartidos no pueden desincronizarse). Producción inyecta valores fuertes en un `.env` raíz (gitignoreado, auto-cargado); local/CI usan defaults `dev-insecure-*` explícitos. Generación documentada en el README (`openssl rand -hex 32`). Validado por Smoke CI (el matching cross-service de JWT sigue intacto). PR #14
- **✅ Migraciones controladas** — `DB_SYNC=true` era red flag si un AppSec lee la config. **Ningún servicio en el compose corre `DB_SYNC=true`**. auth-api (baseline 12 entidades) y billing-api (baseline 4 entidades) ahora poseen su schema vía TypeORM migrations con `migrationsRun` on boot; ambos validados por el Smoke CI en DBs frescas (PRs auth-api #5 / billing-api #2 + bumps #12 / #13). vault-api usa SQL init scripts; zerotrust-api no usa TypeORM synchronize. De paso se sacó un `console.log` que filtraba la password de la DB en el boot de auth-api
- **✅ Anti-replay persistente** — la ventana de replay pasó de un `Map` en memoria (por-instancia) a una tabla `replay_nonces` en Postgres, con check-and-record atómico (`INSERT ... ON CONFLICT DO NOTHING`) — correcto entre reinicios y con escala horizontal. Cubre las 3 superficies: auth-api + billing-api (internal-service guard, vía migración) y vault-api (ZT guard, vía init SQL 058; `verifyZtRequest` quedó pura y el guard persiste tras verificar firma). Cron de prune por minuto. Se eligió Postgres sobre Redis: cada servicio ya tiene Postgres, sin dependencia stateful nueva. Validado por Smoke CI en los 3 bumps (PRs #15/#16/#17)
- **✅ Hardening HTTP** — `helmet` + rate limiting per-IP (`@nestjs/throttler`, 300 req/min, tuneable por env) en las 4 APIs (vault/auth/zt/billing; webhooks de pago eximidos con `@SkipThrottle`). CSP en ambos fronts: `sytadel-app` con nonce por-request (middleware, `force-dynamic`), `sytadel-web` con CSP hash-based built-in de Astro (`security.csp`)
- **✅ `securechain-vault/infra/.env` trackeado en git** — resuelto: `git rm --cached` + gitignore + `git filter-repo` para limpiar historia antes de publicar el repo
- **✅ Firma asimétrica ZT → Vault (Ed25519)** — el hop gateway→Vault dejó de depender del `ZT_HMAC_SECRET` compartido (rotación all-or-nothing). Protocolo v2 firmado con Ed25519 (`x-zt-v:2` + `x-zt-alg` + `x-zt-kid`, canónico que liga alg/kid contra downgrade), keyring de claves públicas por `kid` para rotación sin downtime, clave privada solo en ZT. Migración **reversible y dual-mode**: Vault verifica v1(HMAC)+v2, `ZT_SIGN_MODE` hace el flip por env sin redeploy. De paso Vault ahora recomputa el body-hash (antes confiaba en el header firmado sin validar los bytes). Verify-before-sign: verificador (vault) primero, luego signer (ZT). PRs securechain-vault #17 / zerotrust-api #4 + compose + bumps
- **✅ Admin de policies Zero Trust por tenant** — reemplazó el "policies como archivo estático / store in-memory". auth-api es dueño: tabla `tenant_policy_versions` versionada (una publicada por tenant, resto archived), endpoints admin tenant-scoped (OWNER/ADMIN) `GET/PUT /tenants/:tenantId/policy` + historial/auditoría `GET .../policy/versions`, y endpoint interno firmado que ZT consume. ZT lee la policy publicada (cache con TTL, **fail-safe = deny** si auth-api no responde o la policy es inválida) y aplica **techo de entitlements** (una policy no puede otorgar más allá del plan). Endpoints `/policies/*` de ZT quedaron guardados (JWT+OWNER/ADMIN) antes de retirarse el store. Cerró un bypass de autorización (endpoints sin auth). PRs zerotrust-api #5/#6/#7/#8 + auth-api #8/#9/#11 + bumps

---

## Product maturity track (2027+)

Estas brechas describen el trabajo futuro necesario para que los equipos externos puedan operar los componentes actuales. Las prioridades dependen de la validación con clientes, los requisitos operativos y los riesgos observados.

- **🔮 Extraer `notary-api`** — vía [target-state/notary-api.md](./architecture/target-state/notary-api.md). Hoy embebido en vault-api, funciona
- **🔮 `audit-api` transversal** — cuando 2+ servicios necesiten emitir eventos al mismo trail
- **🔮 Stripe production + customer portal + overages** — validar el modelo comercial y los flujos operativos antes del lanzamiento
- **🔮 SSO / OIDC / SAML** — priorizar cuando segmentos de clientes validados requieran federación
- **🔮 MFA TOTP** — cuando M1 Passkeys resuelva el 80% del problema, TOTP queda como fallback secundario
- **🔮 Proveedor blockchain para notary** — solo si los casos de uso validados lo requieren

---

## Guardrails de priorización

Evitar ampliar el alcance sin una necesidad validada o un riesgo concreto:

- **Evitar interfaces sin un flujo de cliente que las necesite** — priorizar capacidades operativas sobre la cantidad de pantallas.
- **No reescribir multitenancy sin evidencia** — los cambios requieren un driver técnico o de producto.
- **No refactorizar arquitectura sin un driver** — vincular los cambios con una brecha de plataforma o una necesidad operativa verificable.

---

## Cadencia de producto y comunicación

- **1 milestone cada 3-4 semanas** — no menos (calidad baja, signal se diluye), no más (perdés momentum)
- **Publicar una nota técnica cuando aporte evidencia útil** — explicar decisiones, límites y resultados de las capacidades implementadas.
- **Compartir avances con clientes potenciales y usuarios** — usar el feedback para validar problemas, empaquetado y prioridades; no presentar planes como capacidades disponibles.
- **Registrar evidencia de cada milestone** — conservar evaluaciones, resultados de smoke tests, riesgos y límites conocidos.

---

## Priorización por necesidad de producto

Si hay que comprimir las prioridades, ordenar el trabajo según necesidades validadas y riesgos:

| Target | Prioridad |
|--------|-----------|
| Equipo que integra agentes mediante MCP | M3 y controles de herramientas |
| Equipo que delega trabajo con datos sensibles | Identidad, políticas, Vault y evidencia auditable |
| Equipo con requisitos de trazabilidad | Audit/notary y verificación de integridad |
| Requisito de disponibilidad empresarial | Validar primero operación, federación y soporte |

---

## Riesgos abiertos (del sytadel-master §6, siguen vigentes)

- **`DB_SYNC=true`** en dev y demo — si se arrastra a staging destruye datos silenciosamente
- **Notary y Audit no desacoplados** — dependencia interna en vault-api frena refactors del dominio storage. Aceptable en el horizonte actual

_Resueltos: **HMAC compartido ZT↔Vault** → firma asimétrica Ed25519 (dual-mode), y **Zero Trust admin MVP** → admin de policies por tenant en auth-api. Ver "Product hardening track"._

---

## Cómo actualizar este roadmap

- **Cambios de scope:** commit `docs(roadmap): ...`
- **Cambios de estado** (⏭️ → 🟡 → ✅): también acá, no solo en commits de código
- **Nuevos items:** mantener por track (Foundation / Hardening / Maturity)
- **Si algo pasa de un track a otro:** explicar POR QUÉ
- **Revisión programada:** al cierre de cada milestone (M1, M2, M3) y cuando cambien las necesidades validadas, los riesgos o el alcance del producto.
