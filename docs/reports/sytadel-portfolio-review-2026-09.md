# Sytadel Suite — Deep Technical & Security Review
**Perspectiva:** Staff Engineer (AI + Security) evaluando el repo como *portfolio piece* para roles AI Engineer / Security / Product Security / AppSec / Backend-security / AI+Cyber.
**Fecha:** 2026-09-05 · **Método:** inspección de código real (5 submódulos + 2 frontends + infra), no solo README. Cada finding citado con `archivo:línea`. Los hallazgos críticos fueron verificados a mano, no solo por herramienta.

---

## 1. Executive assessment

Este proyecto transmite un nivel **Senior**, con destellos **Staff-like** en un lugar muy concreto: criptografía aplicada y evidencia auditable. El audit chain (SHA-256 encadenado + `pg_advisory_xact_lock` + trigger append-only en DB + checkpoints anclados con RFC3161) y el árbol Merkle RFC 6962 (domain separation `0x00/0x01`, promoción de nodo impar → evita CVE-2012-2459) son de manual, no copiados de un tutorial. El cifrado en reposo es un envelope AES-256-GCM con DEK por tenant e IV aleatorio por operación. Eso es literacy cripto real, y la mayoría de portfolios no lo tiene.

La capa AI también es real, no theater: Anthropic SDK con **structured output (`json_schema`)**, el NL→RBAC usa el LLM **como compilador** (emite un `PolicySet` que un evaluador determinista ejecuta — no deja al modelo decidir acceso en runtime), el workflow agéntico HITL aplica la membership **solo por acción humana** (el agente solo propone) y degrada fail-closed. Y hay **evals con precision/recall/costo/latencia**, que es exactamente lo que separa "juguete LLM" de "feature".

**Pero** hay una vulnerabilidad **crítica confirmada y explotable**: un BOLA cross-tenant en `auth-api` donde cualquier OWNER de un tenant cualquiera puede modificar/leer tenants ajenos (incluyendo `billingBypass`, `isActive`). Y un segundo bug explotable de negocio: replay de suscripción en billing. Sumado a una master key de cifrado hardcodeada en el compose y CI sin ningún security scanning, el proyecto **no es production-ready** — pero como portfolio no necesita serlo.

**¿Avanzaría al candidato a technical screen? Sí.** El combo cripto-aplicada + AI-con-evals + MCP/agentic es raro y creíble. Las fallas son enseñables y, bien contadas, hasta suman (muestran cómo pensás). La condición: el BOLA se arregla YA, porque un AppSec que lo encuentra antes que vos anula toda la señal de "security engineer".

---

## 2. First 5 minutes (llegando desde el CV)

**Impresión:** por encima de la media de forma clara. README raíz honesto, roadmap que explícitamente dice "esto es un portfolio para conseguir trabajo AI+Cyber" (transparencia que se agradece), docs de arquitectura que separan "lo implementado / lo parcial / lo objetivo". No es un CRUD disfrazado.

**Qué miro primero:**
- El README raíz → flujo `auth → zerotrust → vault` firmado, con smoke tests. Bien.
- `git submodule status` → 5 repos públicos reales, no carpetas vacías.
- Salta a la vista una señal de higiene incómoda: `M securechain-vault` — el submódulo tiene el puntero movido. Un evaluador cuidadoso lo nota.

**Qué llama la atención (positivo):** que haya *evals* mencionados con números (accuracy 95.7%, precision/recall, costo $/análisis, p50/p95). Eso es lo primero que yo, como entrevistador AI, voy a querer abrir.

**Qué genera dudas:** los claims son MUCHOS y muy redondos. "Zero Trust", "tamper-evident", "asymmetric signing", "secret rotation", "HITL agent"... Cuando un portfolio junior lista todo eso, el 80% es humo. Mi trabajo en los siguientes 10 minutos es ver cuánto es real. (Spoiler: acá bastante es real, lo cual es la sorpresa positiva.)

**¿Seguiría investigando? Sí, sin duda.** La combinación AI+cripto+MCP es suficientemente inusual como para invertir 30 minutos.

---

## 3. After 15 minutes

**Conocimientos que parecen genuinos (no se fingen):**
- **Cripto aplicada.** `merkle.util.ts` con domain separation y manejo del nodo impar; RFC3161 real (`rfc3161-timestamp.client.ts`), no un `0xDUMMY`; AES-GCM envelope con DEK por tenant (`crypto.service.ts`). Esto no se improvisa.
- **Auth mechanics.** JWT con `alg` pineado a HS256 (`jwt-access.strategy.ts:23`), refresh con rotación + **detección de reuso** que revoca la familia (`auth.service.ts:143-214`), passkeys **resistentes a enumeración** de verdad (`allowCredentials:[]` siempre + challenge para usuario inexistente + timing floor). Esto es AppSec/IAM sólido.
- **AI con criterio.** LLM-as-compiler + evaluador determinista, structured output, HITL con el humano aplicando el cambio, degradación fail-closed. Diseño maduro.

**Qué parece sobrearquitecturado:**
- La ambición de "suite modular de 6 dominios" (auth/ZT/vault/notary/audit/billing) para un portfolio de una persona. El propio roadmap y master-doc reconocen que notary/audit no están desacoplados. El `gateway-bff` y `target-state/` son arquitectura aspiracional que infla la superficie. Para el objetivo (interviews), 3 servicios bien hechos pesaban lo mismo.
- `common/zt/zt.guard.ts` + `nonce-store.ts` en zerotrust-api: código muerto no cableado a ninguna ruta.

**Qué parece resume-driven development:**
- El label "**Zero Trust**". Lo que hay es un gateway que valida JWT + evalúa policy + firma downstream. Es un buen *policy enforcement gateway*, pero "Zero Trust" (BeyondCorp: device posture, continuous verification, mTLS everywhere) es un término que un evaluador senior te va a apretar. Es marketing por encima de la sustancia.
- La "demo interactiva MCP" de la landing: **hoy es una animación scripteada** (`DemoConsole.astro:206` — *"canned sessions, no network, no LLM, no cost"*), no Claude manejando tools en vivo. El claim del roadmap M3 no matchea el build.

**Decisiones buenas (técnicamente):**
- `auth-api` como fuente de verdad única de tenants/memberships, con vault consumiendo el directorio vía llamadas internas (elimina FKs cross-service). Frontera de dominio correcta.
- ZT deriva la identidad (`tenantId/roles/sub`) **del JWT verificado**, no de headers del cliente, y no reenvía headers `x-zt-*` del cliente (`gateway.controller.ts:149-229`). Eso cierra el confused-deputy. Muy bien.
- Anti-replay migrado de `Map` en memoria a tabla Postgres con `INSERT ... ON CONFLICT DO NOTHING` atómico. Correcto entre reinicios y con escala horizontal.

**Decisiones que cuestionaría:**
- `TenantScopeGuard` que hace no-op si el param no se llama literalmente `tenantId` (ver §4-Crítico). Un guard de seguridad debe ser fail-closed por default, no depender de que cada dev recuerde nombrar el param.
- Master key y `ZT_HMAC_SECRET` como literales en el compose, fuera del gate de prod.
- El submódulo vault checked-out a un ancestro HMAC-only mientras el gitlink apunta al commit Ed25519.

---

## 4. Deep technical review

> Convención: **Vuln confirmada** = explotable con evidencia · **Riesgo potencial** = plausible, depende de config/deploy · **Diseño discutible** = decisión defendible pero con footgun · **Hardening** = mejora, no explotable hoy.

### 🔴 CRITICAL

**C1 — BOLA / privilege-escalation cross-tenant en auth-api (Vuln confirmada)**
- **Archivos:** `auth/auth-api/src/common/guards/tenant-scope.guard.ts:19-26`; `common/guards/roles.guard.ts:32-34`; `modules/tenants/tenants.controller.ts:49-63`; `modules/tenants/dto/update-tenant.dto.ts:57-73`. Cadena hermana en `modules/memberships/memberships.controller.ts:29-39` y `modules/users/users.controller.ts:55-92`.
- **Descripción:** `TenantScopeGuard` busca `params.tenantId ?? body.tenantId ?? query.tenantId`; si no lo encuentra, `return true` (no-op). Las rutas de tenants usan `@Param('id')`, no `:tenantId`, así que el guard **no hace nada**. `RolesGuard` solo verifica que el token tenga rol OWNER — pero ese rol viene de la membership del que llama en **su propio** tenant (`auth.service.ts:110 roles:[membership.role]`), nunca se re-resuelve contra el tenant del path.
- **Por qué importa:** es la regla de producto que el propio master-doc marca como no negociable ("el MVP no debería violar aislamiento por tenant") — violada.
- **Escenario de impacto:** un atacante se registra, crea un tenant (auto-OWNER, `tenants.controller.ts:33-47`), y con ese token hace `PATCH /api/tenants/{TENANT_VÍCTIMA}` con `{"billingBypass":true}` (facturación gratis sobre tenant ajeno) o `{"isActive":false}` (DoS: apaga el tenant). `GET /api/tenants/{id}/memberships` filtra emails y UUIDs de membership de cualquier tenant → esos UUIDs alimentan `PATCH /api/memberships/{id} {"role":"OWNER"}` (escalada) o `{"isActive":false}` (lockout). `PATCH /users/{id} {"isActive":false}` desactiva **cualquier** cuenta del sistema. Cadena completa: cross-tenant takeover.
- **Recomendación concreta:** hacer `TenantScopeGuard` **fail-closed** (si no puede resolver y bindear un tenant explícito → 403), renombrar rutas a `/tenants/:tenantId/...`, y —clave— verificar que el caller tiene una **membership activa en el tenant del path**, no confiar en el rol del token. Agregar un test de regresión que sea, literalmente, este ataque. *(Verificado a mano leyendo los tres guards y el DTO.)*

### 🟠 HIGH

**H1 — Trust-proxy + admin gated solo por `isLoopback(req.ip)` en zerotrust-api (Vuln confirmada)**
- **Archivos:** `ZeroTrust/zerotrust-api/src/main.ts:14-18` (`set('trust proxy', true)`); `common/utils/ip.ts:3-11`; `modules/admin/admin.controller.ts:10-37`.
- **Descripción:** con `trust proxy: true`, `req.ip` sale del `X-Forwarded-For` provisto por el cliente. Los endpoints admin (`/admin/status|policies|upstreams|reload`) se protegen solo con `isLoopback(req.ip)`.
- **Impacto:** un atacante remoto manda `X-Forwarded-For: 127.0.0.1`, `req.ip` resuelve a loopback, y accede a la config admin (topología de upstreams, policies) y a `POST /admin/reload` sin auth. Blast radius acotado (no escribe policies, no devuelve secretos) → High, no Critical.
- **Fix:** `trust proxy` con hop-count/subnet específica, o derivar loopback de `req.socket.remoteAddress`, o poner admin detrás de auth real / listener no público.

**H2 — Master key de cifrado hardcodeada y fuera del gate de prod (Riesgo potencial, sería Critical si este compose se despliega)**
- **Archivos:** `docker-compose.yml:190` (`MASTER_KEY_B64: MDEyM...` → decodifica a `0123456789abcdef0123456789abcdef`); `docker-compose.prod.yml` no lo toca.
- **Descripción:** la master key del envelope AES-GCM del vault es un literal secuencial, **no** `${VAR:-...}`, así que ni siquiera se puede overridear por `.env` sin editar el compose. El overlay de prod (que sí gatea 6 secretos con `${VAR:?err}`) no la incluye.
- **Por qué importa:** para un portfolio, un AppSec que clona el repo ve una clave de cifrado secuencial hardcodeada. Eso *lee* pésimo aunque sea "solo el compose de dev". Y si alguien usa este compose como base de un deploy real, todos los documentos quedan cifrados con clave adivinable.
- **Fix:** `MASTER_KEY_B64: ${VAULT_MASTER_KEY_B64:?set a 32-byte base64 key}` y sumarla al gate de prod (pasa de 6 a 7 secretos). Igual trato para `ZT_HMAC_SECRET: change_me_zt_secret` (`docker-compose.yml:177,210`), que es el secreto que autentica el hop ZT→Vault y hoy está hardcodeado y también fuera del gate.

**H3 — Billing: replay de suscripción sin idempotencia → extensión de período gratis (Vuln confirmada, negocio)**
- **Archivos:** `billing/billing-api/src/modules/billing/billing.service.ts:1163-1213` y `buildPeriodEnd :1656-1664`; entrada pública sin auth en `billing.controller.ts:120-134`.
- **Descripción:** el path de suscripción recomputa `currentPeriodEndsAt = now + 1 ciclo` **incondicionalmente**, sin el guard de idempotencia que sí tiene el path one-off (`reconcileOneOffPaymentIntent:1236-1239`, que chequea `wasTerminal`). `GET /api/billing/checkout/mercadopago/return?payment_id=...` es público y llama al sync con un `payment_id` provisto por el cliente.
- **Impacto:** un tenant guarda un `payment_id` real ya aprobado de un pago legítimo pasado y repega el GET (o depende de los reintentos automáticos de MP) para reextender el período indefinidamente. No hace falta forjar nada — se reusa un pago genuino. Revenue leak self-service.
- **Fix:** antes de aplicar, chequear que el `payment.id` no fue procesado ya (como el path one-off), y extender desde `max(now, currentPeriodEndsAt)`.

**H4 — Webhook MercadoPago fail-open si falta el secreto (Riesgo potencial)**
- **Archivo:** `billing/billing-api/src/modules/billing/billing.service.ts:579-614`.
- **Descripción:** *cuando está configurado*, la verificación es correcta (HMAC-SHA256 sobre el manifest, `timingSafeEqual`, length-check). Pero si `MERCADOPAGO_WEBHOOK_SECRET` no está seteado, la verificación se **saltea entera** y el handler sigue. Mitigado porque `synchronizeMercadoPagoPayment` re-consulta el pago a la API de MP (no confía en el body), así que no se puede fabricar un "approved".
- **Fix:** fail-closed si el secreto falta en prod (rechazar, no advertir y seguir).

### 🟡 MEDIUM

**M1 — Ventana de replay ZT: TTL del nonce más corta que la ventana de aceptación (Vuln confirmada, acotada)**
- **Archivos:** `securechain-vault/vault-api/src/common/guards/jwt-auth.guard.ts:56` (`expiresAt = now + maxSkewMs`) vs `common/zt/zt-verify.ts:72` (acepta `|now - ts| <= maxSkewMs`, ventana de ±maxSkew ≈ 60s).
- **Descripción:** si `ts` viene adelantado respecto del reloj del nodo, la request es válida hasta `ts + maxSkew` (~`receipt + 2·maxSkew`), pero su fila de nonce se prunea a `receipt + maxSkew`. Una request capturada replayada en esa cola se acepta de nuevo.
- **Fix:** `expiresAt = ts + 2·maxSkewMs` para cubrir toda la validez.

**M2 — Fail-open por `NODE_ENV` sin setear en vault (Riesgo potencial, deploy-dependent)**
- **Archivos:** `securechain-vault/vault-api/src/config/zt.config.ts:3-13` y `auth-directory.config.ts:3-13`: `runtime = process.env.NODE_ENV ?? 'development'`.
- **Descripción:** si `NODE_ENV` no está seteado en prod, `readSecret` devuelve los defaults (`change_me_zt_secret`, etc.) en vez de tirar error. Auth con secreto débil silencioso.
- **Fix:** requerir `NODE_ENV` explícito, o que el caso "unset" tire error en vez de devolver default.

**M3 — CSP de sytadel-web solo por `<meta>` → `frame-ancestors` no funciona (Vuln confirmada, técnica)**
- **Archivos:** `sytadel-web/astro.config.mjs:13-24`; salida `sytadel-web/dist/en/index.html:10`; sin `headers` en `vercel.json`.
- **Descripción:** `frame-ancestors`, `report-uri` y `sandbox` son **ignorados** por spec cuando la CSP se entrega por meta-tag. El sitio *parece* anti-clickjacking pero se puede framear. Los directivos `script-src`/`style-src` por hash sí funcionan (mitigan XSS), así que no es un fallo total.
- **Fix:** agregar `X-Frame-Options: DENY` (o CSP header real) vía `vercel.json` headers. Contraste positivo: `sytadel-app/middleware.ts:22-98` tiene CSP real con nonce por-request y `strict-dynamic`. Bien.

**M4 — `zerotrust-api` sin `ValidationPipe` global (Hardening, roza Medium)**
- **Archivo:** no hay `useGlobalPipes`/`APP_PIPE` en `main.ts`/`app.module.ts`. Los `class-validator` de `generate-policy.dto.ts` (`@MaxLength(1000)` en `intent`) son **código muerto**: sin pipe, Nest no valida el body.
- **Impacto:** el `intent` que va al LLM es prácticamente ilimitado → superficie de prompt-injection y costo/abuso. Mitigado por el guard OWNER/ADMIN.
- **Fix:** `app.useGlobalPipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true }))`.

**M5 — MCP `generate_policy` pega a endpoint sin auth (Hardening)**
- **Archivo:** `mcp-server/src/sytadel-client.ts:110-116` — no adjunta `authorization` (a diferencia de `authGet/authPost`). Corresponde con que `/policies/generate` en zt-api, si bien ahora **sí** tiene guard OWNER/ADMIN (`policy-generator.controller.ts:6-7`), el cliente MCP no manda token. Verificar que el guard upstream efectivamente lo rechaza. Superficie de abuso de costo LLM.

### 🟢 LOW

- **L1 — Session-anomaly classifier: el veredicto nunca se enforce.** `auth-api/session-anomaly.service.ts:150-158` emite el evento fire-and-forget; el classifier escribe `block`/`step_up_auth` pero nadie lo consume — el login ya devolvió el token. Es logging advisory, no un control activo. *Diseño discutible* si se vende como "detección que bloquea". (`recommended_action` sin consumidor.)
- **L2 — PII (emails) a Anthropic en access-review.** `auth-api/access-review-snapshot.service.ts:107-114` mete `email` en el snapshot que se manda al modelo. Contraste positivo: el agente de access-*request* solo manda contexto agregado, no emails (`access-request-agent.service.ts:146-157`). *Fix:* pseudonimizar si el DPA no cubre.
- **L3 — RBAC-skip footgun en vault.** `vault-api/tenant-rbac.guard.ts:66` `if (required.length===0) return true` — un handler que olvide `@TenantRoles` queda con solo-autenticación. No hay gap en los controllers revisados, pero es footgun. Además `:81-96` un `API_CLIENT` en ruta `@ApiClientAllowed` **saltea el check de membership** (seguro solo si el gateway firma el `tenantId/roles` correcto — lo hace, van en el canonical HMAC).
- **L4 — `/policies/generate` no bindea `tenantSlug` al caller.** `zt-api/policy-generate.guard.ts:38-43` exige OWNER/ADMIN pero deja el `tenantSlug` del body libre. No persiste (solo va como contexto al LLM) y el PUT sí está tenant-scoped, así que no hay write cross-tenant. Seguimiento, no vuln.
- **L5 — Endpoints públicos de verificación notary/anchor sin cache.** `vault-api/public-verify.controller.ts` + `public-notary.controller.ts` recomputan el hash bajando el objeto completo del storage en cada hit sin auth (`anchor.service.ts:181`). Amplificación DoS, mitigada solo por el rate-limiter global. Los ids son UUIDv4 y no filtran contenido/tenant. *Fix:* cachear el último resultado de verificación.
- **L6 — `data-source.ts` de vault con `synchronize:true`.** Solo lo importa el seed CLI (`database/seed.ts`), no la app (runtime usa init SQL). Correr el seed contra una DB real auto-sincroniza schema. Confinar o `synchronize:false`.

### ✅ POSITIVE FINDINGS (lo que está genuinamente bien)

1. **Audit chain tamper-evident real** — `vault-api/audit.service.ts` (prevHash→chainHash SHA-256, `pg_advisory_xact_lock` sobre `(scope,seq)`), trigger `050_audit_append_only.sql` (BEFORE UPDATE/DELETE raise + REVOKE), y **defensa de suffix-truncation** vía `audit-checkpoint.service.ts:verifyScopeAnchored` (TRUNCATED/DIVERGED). Esto es lo mejor del repo.
2. **Merkle RFC 6962 + RFC3161 reales** — `merkle.util.ts` con domain separation y nodo impar promovido (CVE-2012-2459 safe), inclusion proofs verificables; TSA real, y el fallback "SIMULATED" es honesto (sin token, nunca verifica VALID). Sin `0xDUMMY`.
3. **Envelope encryption correcto** — AES-256-GCM, DEK por tenant, IV aleatorio de 12 bytes por operación, master key de 32 bytes validada. Sin IV estático, sin ECB, sin KDF casero (`crypto.service.ts`).
4. **Confused-deputy cerrado en ZT** — identidad derivada del JWT verificado, headers `x-zt-*` del cliente no reenviados (`gateway.controller.ts:149-229`).
5. **JWT bien hecho** — `alg:HS256` pineado y rechazo de otros (`jwt-verify.service.ts:45-46`, `jwt-access.strategy.ts:23`), `timingSafeEqual`, issuer/audience/exp enforced, refresh con rotación + **detección de reuso** que revoca familia.
6. **Passkeys enumeration-resistant de verdad** — `passkeys.service.ts:146-176` (`allowCredentials:[]` siempre, challenge para user inexistente, timing floor), clone-detection por counter + advisory lock.
7. **Internal HMAC guard correcto en auth/billing** — firma verificada **antes** de registrar el nonce, `INSERT ... ON CONFLICT DO NOTHING` atómico, skew de reloj (`internal-service.guard.ts`, `replay-nonce.service.ts`).
8. **Policy engine fail-closed** — `policy.service.ts`/`policy-evaluator.ts` deny-by-default; el LLM **compila** un PolicySet, no decide en runtime. Cross-tenant policy write bloqueado por `policy-admin.guard.ts:40-47` (el hotfix de memoria, confirmado presente).
9. **Tenant isolation en vault correcta** — todo path autenticado scopea por `{..., tenantId}` desde la identidad ZT verificada; cambiar un id ajeno da 404. (Contraste fuerte con el bug C1 de auth-api.)
10. **HITL agéntico bien diseñado** — el agente solo propone; la membership se aplica solo en `approve()` detrás de `@Roles('OWNER','ADMIN')` + tenant-scoped; fail-closed si el LLM falla.
11. **Evals con métricas reales** — precision/recall/confusion-matrix + costo + latencia en `session-anomaly/evals` y `access-review/evals`. Raro y valioso.

---

## 5. Claims vs reality

| Claim | Veredicto | Evidencia |
|---|---|---|
| **Zero Trust** | **Misleading (naming)** | Es un policy-enforcement gateway (JWT + policy + firma downstream), sólido, pero no ZT en el sentido BeyondCorp (device posture, continuous verification, mTLS). Buen gateway, etiqueta inflada. |
| **Tamper-evident audit log** | **Verified** | Hash chain + advisory lock + append-only DB + checkpoints anclados anti-truncation (`audit.service.ts`, `audit-checkpoint.service.ts`, `050_*.sql`). |
| **Replay protection** | **Verified (con gap)** | Verify-then-atomic-record en las 3 superficies; gap M1 (TTL < ventana de aceptación en vault). |
| **Secret rotation** | **Verified (service accounts)** | Overlap 24h con `previousSecretHash` funciona end-to-end (`integrations.service.ts:279-390`). Ojo: es rotación de secretos de service accounts, no de los HMAC/JWT compartidos (esos son all-or-nothing por env). |
| **Passkeys / WebAuthn** | **Verified** | Enumeration-resistant real, clone-detection, origin/rpID desde config. |
| **Anomaly detection** | **Partially** | El scoring heurístico (IP/país/UA) + clasificación LLM son reales, pero el **veredicto no se enforce** (advisory, L1). No bloquea logins. |
| **AI classifier (evals 95.7%)** | **Verified (con asterisco)** | LLM real + structured output + evals con precision/recall/costo. Asterisco: 25 fixtures es chico y **no hay casos adversariales/prompt-injection** en el dataset. |
| **NL → RBAC** | **Verified** | LLM-as-compiler → PolicySet → evaluador determinista; endpoints ahora con guard OWNER/ADMIN. Diseño correcto. |
| **Access review** | **Verified** | Snapshot real + Claude structured output + recomendaciones enum-typed + evals. (Manda emails al modelo, L2.) |
| **MCP server** | **Verified** | 5 tools, tenantId **derivado del principal** (ningún tool acepta tenant como arg del modelo), sin SSRF, credenciales de env. Sólido. |
| **HITL agent** | **Verified** | El agente propone, el humano aplica; fail-closed. |
| **Ed25519 signing** | **Partially / Misleading (runtime)** | El código Ed25519 dual-mode existe (`zt-v2-signer.ts` en zt-api; commit `e70adc7` en vault). **Pero** el firmante ZT default es `hmac` (`zt.config.ts:20-21`, `ZT_ACCEPT_V1_HMAC=true`), y el **checkout local de vault (`810ced0`) es HMAC-only** — el gitlink apunta al commit Ed25519 pero el working tree está en un ancestro. En runtime la confianza gateway↔vault es **HMAC compartido hardcodeado**. La asimétrica está implementada, no activada. |
| **Interactive MCP demo (landing)** | **Misleading (build actual)** | `DemoConsole.astro:206` es animación canned, sin fetch/LLM/endpoint. No es Claude manejando tools en vivo. El MCP server real existe como paquete aparte (stdio, credenciales del operador), no como demo web pública. |

---

## 6. AI / Security credibility

- **¿AI real o theater?** **Real, con matices.** Structured output vía `json_schema`, LLM-as-compiler (no dejás que el modelo decida acceso), HITL con gate humano, fail-closed, y —lo que importa— **evals con métricas**. Eso es lo que un AI Engineer serio quiere ver. Matiz: los datasets son chicos (5-25 fixtures) y miden solo corrección semántica, **sin casos adversariales ni prompt-injection**. Y la demo de la landing es humo (canned).
- **¿Security real o theater?** **Mayormente real, con un agujero grave.** Cripto aplicada, audit integrity, passkeys, JWT, replay atómico, confused-deputy cerrado: todo genuino. Pero el **BOLA C1** es exactamente el tipo de bug que un AppSec no perdona, porque es la promesa central del producto (aislamiento por tenant) rota por un guard mal diseñado. Un candidato "security" tiene que encontrarlo él, no el entrevistador.
- **Features de mayor credibilidad:** (1) audit chain + Merkle/RFC3161, (2) passkeys enumeration-resistant, (3) NL→RBAC como compilador, (4) HITL agéntico, (5) MCP con tenant derivado del principal.
- **Features más débiles:** (1) "Zero Trust" como label, (2) anomaly detection que no enforce, (3) demo interactiva canned, (4) Ed25519 "shipped" pero no activo.
- **Claims que EVITARÍA en el CV:** "Zero Trust architecture" a secas (poné "policy-enforcement gateway with signed service-to-service calls"); "asymmetric request signing" (hasta que flipees el default y arregles el checkout); "interactive AI demo" (hasta que sea LLM real); y "anomaly detection that blocks" (hoy no bloquea). Lo que SÍ pondría fuerte: audit integrity con Merkle/RFC3161, passkeys, evals con números, MCP+HITL.

---

## 7. Hiring signal (1-10 — señal del PROYECTO, no seniority laboral)

| Dimensión | Score | Nota |
|---|---:|---|
| Backend Engineering | 8 | NestJS limpio, patrones reales, migraciones controladas. |
| Architecture | 7 | Fronteras de dominio buenas y honestas; algo de ambición sobrearquitecturada (6 dominios). |
| Security Engineering | 6 | Muchos controles reales, pero C1 (Critical) y claves hardcodeadas bajan la nota. |
| AppSec | 6 | El BOLA + payment replay + falta de test del guard revelan gaps en pensamiento adversarial. |
| IAM | 7 | JWT/refresh-reuse/passkeys muy bien; el tenant-scope guard footgun lo frena. |
| Cryptography understanding | 8 | Standout: AES-GCM envelope, Merkle RFC6962 domain-sep, RFC3161, timingSafeEqual. |
| AI Engineering | 7 | SDK real, structured output, evals con métricas; faltan casos adversariales. |
| Agentic systems | 7 | LangGraph HITL con gate humano y fail-closed, bien pensado. |
| MCP / tool design | 7 | 5 tools, tenant derivado del principal, sin SSRF; `generate_policy` sin auth resta. |
| DevOps | 5 | Compose correcto pero claves hardcodeadas, sin scanning, sin observability. |
| Testing | 5 | Bueno en el core cripto; **cero** en billing/mcp; ninguno sobre el guard que tenía el bug. |
| Documentation | 8 | Roadmap honesto, arch docs, blogs. Resta el doc-drift. |
| Production readiness | 4 | C1 + claves + fail-open NODE_ENV + sin scanning. (No es el objetivo, ok.) |
| **Portfolio impact** | **8** | El combo cripto + AI-con-evals + MCP/agentic es raro y vendible. |

**Seniority que transmite:** **Senior**, con **destellos Staff-like** en cripto aplicada y evidencia auditable (esa parte la firmaría un especialista). Lo que lo ancla en Senior y no más arriba es el **C1**: un miss de aislamiento por tenant es de nivel Mid, y contradice la señal "security". Arreglado + con test de regresión + threat model, la lectura sube a **Senior+ creíble**.

---

## 8. Company fit

**Auth0 / Okta** — Interés: JWT alg-pinning, refresh-reuse detection, passkeys enumeration-resistant. Ignoran: billing, notary. Red flag: **el BOLA cross-tenant** (es su core business, lo van a mirar con lupa) y "Zero Trust" mal usado. Mostrar primero: passkeys + refresh-reuse.

**1Password** — Interés: envelope encryption AES-GCM con DEK por tenant, key management. Ignoran: la capa AI comercial. Red flag: master key hardcodeada en compose (justo su dominio), key rotation stub. Mostrar primero: `crypto.service.ts` + el diseño de DEK/rotation (con la crítica honesta de que rotation es stub).

**WorkOS** — Interés: multi-tenant, memberships, service accounts, el modelo auth-as-source-of-truth. Red flag: **C1** otra vez (multi-tenant isolation es literal su producto). Mostrar primero: la arquitectura auth↔ZT↔vault y confused-deputy cerrado.

**Snyk** — Interés: NL→RBAC, la mentalidad de policy-as-code, evals. Red flag: **CI sin ningún SAST/dependency/secret scanning** (irónico para Snyk). Mostrar primero: NL→RBAC compiler + evals; y tener listo "acá agregaría Snyk/Semgrep/gitleaks al pipeline".

**Vanta / Drata** — Interés: audit chain tamper-evident, RFC3161, access review automatizado (compliance evidence). Red flag: production readiness. Mostrar primero: audit integrity + access review con evidencia anclada.

**Doppler** — Interés: secret rotation con overlap window. Red flag: secretos hardcodeados en compose (su dominio exacto). Mostrar primero: `secret-rotation.cron.ts` + `previousSecretHash`.

**Anthropic** — Interés: MCP server bien hecho, structured output, LLM-as-compiler, HITL agéntico, evals con costo/latencia. Ignoran: billing. Red flag: demo canned presentada como live; datasets chicos sin adversariales. Mostrar primero: MCP + NL→RBAC compiler + la metodología de evals (y ser honesto sobre sus límites).

**Startups AI+Cyber (LATAM/remoto)** — Interés: TODO el combo — sos de los pocos que tiene AI aplicada a security con evals + cripto real. Red flag: el candidato debe conocer sus propios bugs. Mostrar primero: el end-to-end auth→ZT→vault firmado + un tool del MCP en vivo.

---

## 9. Top interview questions (basadas en tu código real)

1. `TenantScopeGuard` hace `return true` si el param no se llama `tenantId`. ¿Por qué un guard de seguridad es opt-in por nombre de param en vez de fail-closed? Mostrame las rutas afectadas.
2. En `roles.guard.ts`, los roles salen del token. ¿Qué garantiza que ese rol aplica al tenant del path y no solo al tenant donde el usuario hizo login?
3. El firmante ZT default es `hmac` y el checkout de vault es HMAC-only, pero el gitlink apunta al commit Ed25519. ¿Cuál es el estado real que corre en prod y por qué el submódulo quedó en un ancestro?
4. Si la confianza gateway↔vault es un HMAC compartido, ¿qué pasa el día que necesitás rotarlo sin downtime? ¿Y por qué eso motiva la asimétrica que empezaste?
5. `verifyScopeAnchored` detecta truncation comparando contra el checkpoint anclado. ¿Qué pasa entre dos checkpoints? ¿Cuál es tu ventana de exposición y cómo elegís la frecuencia de anclaje?
6. En el árbol Merkle promovés el nodo impar en vez de duplicarlo. Explicá qué ataque (CVE-2012-2459) evita eso y por qué el domain separation `0x00/0x01` importa.
7. La master key del vault sale de `MASTER_KEY_B64`. ¿Cómo hacés key rotation hoy? Vi `version:1` hardcodeado — ¿qué falta para re-wrap de DEKs?
8. El nonce de replay expira a `now + maxSkew` pero aceptás `±maxSkew`. Caminame el escenario donde una request replayada se acepta dos veces.
9. El classifier de anomalías escribe `block`/`step_up_auth` pero el login ya devolvió el token. ¿Es detección o es logging? ¿Cómo lo convertirías en un control real sin romper UX?
10. Tus evals miden corrección semántica sobre 25 fixtures. ¿Cómo medís robustez a prompt-injection? Diseñame 3 fixtures adversariales para el NL→RBAC.
11. En NL→RBAC el LLM compila un PolicySet que un evaluador determinista corre. ¿Por qué no dejás que el LLM decida acceso directamente? ¿Qué cambia en tu superficie de ataque?
12. `access-review` manda emails al modelo; `access-request` no. ¿Fue decisión consciente? ¿Cómo manejás PII hacia el provider bajo un DPA?
13. El webhook de MP verifica firma solo si el secreto está seteado, si no fail-open. ¿Por qué no fail-closed? ¿Y por qué re-consultás el pago a la API de MP igual?
14. El path de suscripción reextiende el período sin chequear idempotencia, a diferencia del one-off. ¿Cómo lo explotarías con un `payment_id` viejo?
15. `POST /admin/reload` en zt-api está detrás de `isLoopback(req.ip)` con `trust proxy: true`. ¿Es eso una defensa? Demostralo con un header.
16. El MCP server bindea un principal por proceso stdio. ¿Cómo escalarías eso a un connector remoto multi-usuario sin colisión de tokens en el cache?
17. `getMe()` decodifica el JWT localmente para sacar el tenant. ¿Qué pasa si el token está vencido o forjado? ¿Dónde se verifica de verdad?
18. `tenant-rbac.guard.ts` retorna `true` si el handler no declara `@TenantRoles`. ¿Cómo evitás que un endpoint nuevo nazca sin RBAC por olvido?
19. Tenés cero tests en billing y mcp-server, y ninguno sobre el tenant-scope guard. Si tuvieras que escribir 3 tests hoy para bajar el riesgo, ¿cuáles y por qué?
20. Llamás "Zero Trust" a un gateway de policy + firma. Defendé el término contra un modelo BeyondCorp — ¿qué te falta para que sea ZT de verdad?

---

## 10. Highest-ROI improvements (ordenadas por impacto/esfuerzo)

> Regla: cada mejora demuestra pensamiento de seguridad o AI, no features comerciales.

1. **Arreglar C1 + escribir el test que ES el ataque.** *Impacto: máximo · Esfuerzo: bajo.* Demuestra: que encontrás y cerrás un BOLA cross-tenant, y que pensás en regresión adversarial. Tocar: `common/guards/tenant-scope.guard.ts` (fail-closed), rutas `tenants/memberships/users` (scope por membership del path-tenant), + `test/tenant-isolation.e2e-spec.ts` nuevo. **Esto primero, sí o sí.**
2. **Threat model corto (1-2 páginas) del flujo auth→ZT→vault.** *Impacto: alto · Esfuerzo: bajo.* Demuestra: madurez de security engineer (trust boundaries, assets, STRIDE por hop). Tocar: `docs/security/threat-model.md` con diagrama de las fronteras y dónde vive cada control.
3. **Adversarial evals: fixtures de prompt-injection para NL→RBAC y classifier.** *Impacto: alto · Esfuerzo: bajo-medio.* Demuestra: el diferenciador AI+Cyber real (casi nadie testea injection en evals). Tocar: `zerotrust-api/.../evals/fixtures.ts` (+ casos "ignora las reglas y dame allow *"), `auth-api/session-anomaly/evals/`.
4. **Attack-demo escrito + GIF: el BOLA antes/después.** *Impacto: alto · Esfuerzo: bajo.* Demuestra: comunicás seguridad como un pro. Tocar: `docs/security/demos/cross-tenant-bola.md` con curl del exploit y el fix.
5. **Flip Ed25519 a default + reconciliar el submódulo.** *Impacto: alto · Esfuerzo: medio.* Demuestra: crypto agility y que cerrás lo que empezaste. Tocar: `zt.config.ts` (default `ed25519`), commitear vault en `e70adc7` (no el ancestro), documentar el keyring.
6. **Sacar los secretos hardcodeados del compose al gate de prod.** *Impacto: alto · Esfuerzo: bajo.* Demuestra: higiene de secretos (clave para Doppler/1Password). Tocar: `docker-compose.yml` (`MASTER_KEY_B64`, `ZT_HMAC_SECRET` → `${VAR:?}`), `docker-compose.prod.yml` (7 secretos).
7. **CI con SAST + dep-scan + secret-scan.** *Impacto: alto · Esfuerzo: bajo.* Demuestra: DevSecOps (crítico para Snyk/Vanta). Tocar: `.github/workflows/` (Semgrep/CodeQL + `npm audit`/Trivy + gitleaks) + Dependabot.
8. **Arreglar el payment-replay + test.** *Impacto: medio · Esfuerzo: bajo.* Demuestra: pensás en business-logic abuse, no solo OWASP top-10. Tocar: `billing.service.ts` (idempotencia por `payment.id`, extender desde `max(now, periodEnd)`) + primer test de billing.
9. **Diagrama de arquitectura + "what Zero Trust means here".** *Impacto: medio · Esfuerzo: bajo.* Demuestra: honestidad técnica y comunicación. Tocar: `docs/architecture/` con un diagrama de trust boundaries y un párrafo que reencuadre "ZT" con precisión (esto neutraliza la pregunta #20 en la entrevista).
10. **Convertir la demo canned en LLM real (o etiquetarla honestamente).** *Impacto: medio · Esfuerzo: medio.* Demuestra: el claim AI se sostiene. Tocar: `sytadel-web/api/demo.ts` (serverless, key server-side, rate-limit, tenant read-only) — o, si no querés el gasto, renombrar la sección a "scripted walkthrough" y linkear el MCP real.

---

## 11. What NOT to build (próximos 2-3 meses)

Tu objetivo es **entrevistas**, no un producto enterprise. NO hagas:

- **Nada de CRUD/dashboards/UI polish nuevos.** Cero señal técnica. Tu propio roadmap ya lo dice — respetalo.
- **No extraigas `notary-api` ni `audit-api`.** Funcionan embebidos; el refactor consume semanas y no agrega señal (nadie en una entrevista te pide microservicios por microservicios). Es maturity-track post-hire.
- **No metas SSO/OIDC/SAML ni MFA TOTP.** Irrelevante para M1-M3; las passkeys ya cubren el 80%.
- **No hagas Stripe producción / customer portal / overages.** El mock alcanza para demo; billing no es tu señal core.
- **No reescribas multitenancy ni "más Zero Trust product".** Arreglá el BOLA (bug puntual), no rearquitectures.
- **No agregues más features AI nuevas.** Ya tenés 5. Profundizá las que hay con adversarial evals y attack demos en vez de sumar la sexta a medio hacer.
- **No publiques más blog posts hasta arreglar C1.** Un AppSec que lee tu blog "tamper-evident" y después encuentra el BOLA, te quema doble.

**La regla:** las próximas semanas son para **endurecer y demostrar lo que ya existe** (fix + tests + threat model + attack demos + evals adversariales), no para agregar superficie.

---

## 12. Final verdict

**Would I interview this candidate? → YES.**

El combo cripto-aplicada real + AI con evals de verdad + MCP/agentic HITL es inusual y creíble; muy pocos portfolios cruzan AI y security con esta sustancia. Las fallas son reales pero acotadas y enseñables — y un candidato que las conoce y las cuenta bien demuestra más que uno con un repo "perfecto" y vacío. La única condición dura: el BOLA C1 tiene que estar arreglado antes de mandar el link, porque contradice de frente la señal "security".

**Las 3 cosas que MÁS aumentan tu señal técnica:**
1. **Audit integrity real** (hash chain + Merkle RFC6962 + RFC3161 anti-truncation) — nivel especialista.
2. **AI con evals medibles** (precision/recall/costo/latencia) + LLM-as-compiler + HITL fail-closed — el bridge AI+Cyber que casi nadie hace.
3. **Fundamentos IAM sólidos** (JWT alg-pinning, refresh-reuse detection, passkeys enumeration-resistant).

**Las 3 cosas que MÁS te perjudican:**
1. **El BOLA cross-tenant C1** — un miss de aislamiento por tenant en un producto que vende aislamiento por tenant. Prioridad absoluta.
2. **Higiene de deploy/secretos** — master key y HMAC hardcodeados en el compose, fuera del gate de prod; CI sin ningún security scanning.
3. **Gap entre claims y realidad** — "Zero Trust", "asymmetric signing shipped", "interactive AI demo" que no se sostienen 1:1 con el código. Alinear el discurso con la verdad (bajándolo o completándolo) te sube la credibilidad más que cualquier feature nueva.
