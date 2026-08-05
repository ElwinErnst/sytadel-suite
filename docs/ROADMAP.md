# Sytadel Suite — Roadmap

## Objetivo actual del proyecto

**Usar Sytadel Suite como portfolio piece para conseguir un rol de AI + Cybersecurity engineering en los próximos 3-6 meses.**

Prioridad: signal técnico dirigido a roles específicos > madurez del producto como negocio.

Este roadmap NO es "hacer un producto para vender". Es **producir señal técnica dirigida a las audiencias que apuntamos**: Auth0, Clerk, 1Password, WorkOS, Snyk, Doppler, Vanta, Anthropic contractors, y startups early-stage de AI + Cyber.

Cuando un screener entra a `sytadel-labs.com` desde el link del CV, tiene que ver dos cosas que la mayoría de portfolios no tiene:

1. **Fundamentos de seguridad modernos ejecutados bien** (passkeys, audit chain, session detection) — prueba de nivel AppSec
2. **AI aplicada al problema de seguridad real** (LLM classifier, MCP server) — prueba del bridge AI+Cyber que casi nadie hace

Referencias:
- Estrategia base: `career-ops/interview-prep/sytadel-roadmap.md` (2026-07-26)
- Estado técnico y arquitectura: [architecture/](./architecture/) + [sytadel-master-es.md](./architecture/sytadel-master-es.md)

## Cómo leer este roadmap

Tres tracks paralelos con prioridades distintas:

- **Portfolio track (Q3-Q4 2026)** — objetivo primario. Milestones M1/M2/M3
- **Product hardening (Q4 2026, en paralelo)** — mínimo indispensable para que el portfolio no se vea flojo si un evaluador clona y corre el repo
- **Product maturity (2027+)** — explícitamente pospuesto. Se retoma después del hire

Estados: **✅ Hecho** | **🟡 En curso** | **⏭️ Próximo** | **🔮 Después** | **❌ Descartado**

---

## Prerequisitos (bloqueadores antes de arrancar M1)

Sin esto, el resto del roadmap no tiene dónde apoyarse:

- **✅ Repos públicos** — los 5 (meta + 4 submódulos) son PUBLIC en `github.com/ElwinErnst/*`. Historia auditada, `security-assessment.docx` y email de contributor externo sanitizados con `git filter-repo`
- **✅ Landing pública en `sytadel-labs.com`** — deployada en Vercel apuntando a `sentinel-web`. Topbar + footer linkean al repo público del meta
- **✅ Estructura mínima corriendo** — auth, RBAC, vaults, documents, tenants, billing están funcionales y verificados con smoke tests

**Definition of done cumplido:** un evaluador entra a `sytadel-labs.com`, ve qué hace el producto, ve el link a GitHub en el topbar, y salta al repo público con doc + demo runnable.

---

## Portfolio track (Q3-Q4 2026)

### M1 — Fundamentos de seguridad modernos (semanas 1-3)

**Audiencia signal:** Auth0, Clerk, 1Password, WorkOS, Snyk, Doppler, Vanta, AppSec generalist.

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

**M1 cerrado.** Cadencia sugerida de publicación: 1 post cada 3-4 días desde dev.to (perfil ya armado), cross-post a LinkedIn con hook + link.

### M2 — Capa AI-powered de seguridad (semanas 4-7)

**Audiencia signal:** Anthropic contractors, Auth0 AI, Snyk AI, "Product Security Engineer with AI focus".

| Feature | Estado | Notas |
|---------|--------|-------|
| **LLM anomaly classifier** | ✅ | End-to-end en producción. Pipeline async: analyzer heurístico → `ANOMALY_PERSISTED_EVENT` (EventEmitter2) → listener → Claude Sonnet 5 con structured output → persiste en `session_anomaly_classifications`. Verificado: login desde IP fresca disparó `suspicious` con confidence 0.60 → `step_up_auth`, 3.7s. **Evals sobre 25 fixtures: accuracy 95.7%, critical class precision 1.00 / recall 1.00, cost $0.00506/análisis, p50 4s / p95 8.7s.** Blog post: [`2026-08-llm-anomaly-classifier.md`](./blog/2026-08-llm-anomaly-classifier.md). Diseño: [`architecture/m2-llm-anomaly-classifier.md`](./architecture/m2-llm-anomaly-classifier.md) |
| **Natural language → RBAC policy generator** | ✅ | LLM-as-compiler live en `zerotrust-api/modules/policy-generator/` + engine live que evalúa las policies en el gateway (`policy-evaluator.ts` puro + `PolicyStoreService` in-memory + `PolicyService.decide()` con fallback a hardcoded). Endpoints: `POST /policies/generate`, `PUT/GET/DELETE /policies/:tenantId`. **Evals sobre 8 fixtures × 34 expectations: 6/8 fixtures OK, 30/34 expectations (88.2%), 0 errores de generación, $0.00790/gen, p50 3.1s / p95 7.4s.** Smoke end-to-end: PUT deny-all → mismo OWNER pasa de 200 a 403. Blog post: [`2026-08-nl-to-rbac-policy-generator.md`](./blog/2026-08-nl-to-rbac-policy-generator.md) |
| **AI-driven access review** | ⏭️ | Job scheduled: LLM analiza permisos, sugiere revocaciones, genera reporte markdown. No arrancado |

**Decisiones técnicas clave:**
- Modelo principal: Claude Sonnet 5 vía API (cost-effective, structured output)
- Opción secundaria: modelo local (Llama 3 vía Ollama) — angle "data residency" para EU/regulated
- **Evals obligatorios:** dataset propio de 20-30 casos etiquetados, precision/recall reportados. Sin evals, un feature con LLM es "un juguete"

**Deliverables al cierre:**
- Blog post: *"Using Claude to review your org's access sprawl — with actual eval metrics"* — dev.to + LinkedIn + Show HN
- Sección nueva en CV: "SytadelSuite AI Security Layer"
- Números: precision/recall del classifier, cost por análisis (USD), latencia p95, tokens promedio por query

### M3 — MCP + Agentic (semanas 8-11)

**Audiencia signal:** Anthropic ecosystem, startup early-stage AI+Cyber, "AI Engineer Product-focused".

| Feature | Estado | Notas |
|---------|--------|-------|
| **Sytadel MCP server** | ⏭️ | Expone `list users`, `query audit log`, `revoke access`, `create policy` como tools MCP. Publicado como paquete npm `@sytadel/mcp-server` |
| **Agentic approval workflow con HITL** | ⏭️ | Request de acceso → agente LLM propone decisión → humano aprueba con un click → registro. LangGraph JS mínimo |
| **Portfolio landing con demo interactiva** | ⏭️ | Botón "Connect" en `sytadel-labs.com` que conecta el MCP server al Claude Desktop del visitante. "Click and try", no "clone and setup" |

**Decisiones técnicas clave:**
- MCP server en TypeScript con SDK oficial de Anthropic
- Documentar en README cómo conectar desde Claude Desktop y desde Cursor (con screenshots)
- No reinventar el orquestador — usar LangGraph JS o similar. Foco en prompt design y diseño de tools

**Deliverables al cierre:**
- Blog post: *"Building an MCP server for identity infrastructure — a case study"* — dev.to + LinkedIn + submit a Anthropic community
- Paquete npm publicado
- Números: cantidad de tools expuestas, latencia end-to-end del workflow (request → approval), % de approvals que el agente propone correctamente vs. lo que decide el humano

---

## Product hardening track (Q4 2026, en paralelo)

Mínimo indispensable para que si un AppSec engineer clona el repo y lee el código, no vea red flags. No consume slot de milestone, se hace en huecos.

- **🟡 Rotar defaults `change-me-*` del compose** — M1 automated rotation cubrió las credenciales de service accounts. Los HMAC/JWT secrets compartidos entre auth/vault/zt siguen como `change-me-*` en el compose; hay que mover a `.env` real cuando se salga de demo local
- **🟡 Migraciones controladas** — `DB_SYNC=true` es red flag si un AppSec lee la config. Migrar a TypeORM migrations por servicio
- **⏭️ Anti-replay persistente** — mover ventana HMAC de memoria a Redis o table dedicada. Red flag menor pero importante para escala horizontal
- **⏭️ Hardening HTTP** — `helmet`, rate limiting, CSP en frontends
- **✅ `securechain-vault/infra/.env` trackeado en git** — resuelto: `git rm --cached` + gitignore + `git filter-repo` para limpiar historia antes de publicar el repo

---

## Product maturity track (2027+, después del hire)

Explícitamente pospuesto. Estas eran las prioridades del roadmap anterior — no son signal para roles AI/Cyber engineering. Se retoman cuando el objetivo primario esté cumplido.

- **🔮 Extraer `notary-api`** — vía [target-state/notary-api.md](./architecture/target-state/notary-api.md). Hoy embebido en vault-api, funciona
- **🔮 `audit-api` transversal** — cuando 2+ servicios necesiten emitir eventos al mismo trail
- **🔮 Stripe production + customer portal + overages** — el mock checkout alcanza para demo
- **🔮 SSO / OIDC / SAML enterprise** — irrelevante para interviews de M1-M3
- **🔮 MFA TOTP** — cuando M1 Passkeys resuelva el 80% del problema, TOTP queda como fallback secundario
- **🔮 Provider blockchain real para notary** — sólo si el target profesional se corre a Web3

---

## Trampas de tiempo (explícitamente NO hacer)

Features tentadoras con ROI cero para la ventana actual:

- **❌ App mobile** — 0 signal para roles AI/Cyber, 2 meses perdidos
- **❌ Enterprise dashboards con 50 vistas** — nadie los prueba en un demo
- **❌ UI polish perfecto** — función > forma. Demo funcional feo abre más puertas que demo bonito que no hace nada
- **❌ Reescribir multitenancy** — ya está hecha y funciona. Mantener, no invertir más. Career-ops decía "simulá con dropdown" pero como ya está hecho, no retrocedemos
- **❌ Refactor de arquitectura sin driver** — el stack actual sirve para los 3 milestones. Cambios arquitectónicos van al track de maturity

---

## Cadencia y ritual

- **1 milestone cada 3-4 semanas** — no menos (calidad baja, signal se diluye), no más (perdés momentum)
- **1 blog post al cierre de cada milestone** — no opcional. Sin amplificación, el código público no lo ve nadie
- **CV update + LinkedIn post al cierre de cada milestone** — el proof point va escalando
- **Aplicar a 3-5 roles nuevos al cierre de cada milestone** usando el bullet nuevo como diferenciador en el cover letter. Medir response rate
- **Trackear en `career-ops/interview-prep/story-bank.md`** métricas concretas de cada milestone (STAR+R stories)

---

## Priorización por rol target

Si en un momento hay que comprimir el track:

| Target | Prioridad |
|--------|-----------|
| Anthropic contractor / Claude ecosystem | M3 primero |
| Auth0 / Clerk / WorkOS / 1Password | M1 + M2 |
| Snyk / Doppler / Vanta / Drata (DevSecOps) | M1 + M2 con énfasis secret rotation + policy generation |
| AppSec generalist | M1 completo |
| Startup early-stage AI+Cyber (LATAM/remoto) | Los 3 = perfil imbatible en la región |

---

## Riesgos abiertos (del sytadel-master §6, siguen vigentes)

- **HMAC compartido** entre ZT y Vault vs. criptografía asimétrica — rotación de secretos es all-or-nothing hoy
- **`DB_SYNC=true`** en dev y demo — si se arrastra a staging destruye datos silenciosamente
- **Notary y Audit no desacoplados** — dependencia interna en vault-api frena refactors del dominio storage. Aceptable en el horizonte actual
- **Zero Trust admin muy MVP** — policies como archivo estático, sin admin por tenant. Aceptable si el rol target no es "ZT product engineer"

---

## Cómo actualizar este roadmap

- **Cambios de scope:** commit `docs(roadmap): ...`
- **Cambios de estado** (⏭️ → 🟡 → ✅): también acá, no solo en commits de código
- **Nuevos items:** mantener por track (Portfolio / Hardening / Maturity)
- **Si algo pasa de un track a otro:** explicar POR QUÉ
- **Revisión programada:** al cierre de cada milestone (M1, M2, M3). Revisar también si el objetivo cambia (por ejemplo: si se consigue trabajo antes de M3, se puede pivotar a producto)
