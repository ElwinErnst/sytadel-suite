# Sytadel Suite — Roadmap

Este documento operacionaliza las prioridades del [documento maestro](./architecture/sytadel-master-es.md) y los objetivos de la [arquitectura target](./architecture/target-state/) en un plan de trabajo ordenado por horizonte.

No es un plan cerrado con fechas rígidas: es la foto viva del rumbo. Cada item indica su estado real hoy y evoluciona con las decisiones del equipo.

## Cómo leer este roadmap

- **✅ Hecho** — mergeado en `main` y verificado con smoke tests
- **🟡 En curso** — parcialmente implementado, hay tareas concretas identificadas
- **⏭️ Próximo** — decidido pero no arrancado
- **🔮 Después** — depende de aprendizajes o de terminar lo anterior
- **❌ Fuera de scope** — evaluado y descartado (o pospuesto sin fecha)

---

## Ahora (Q3 2026) — Consolidar seguridad y multi-servicio B2B

**Objetivo:** cerrar el modelo de service accounts + client apps + billing metering que quedó implementado en la última iteración, endurecer secretos y dejar el stack apto para un primer piloto B2B real.

### Ya implementado (base para lo que sigue)

- **✅ HMAC entre servicios** — `auth-api`, `vault-api`, `zerotrust-api` firman y verifican llamadas internas con HMAC-SHA256 sobre path + timestamp + body
- **✅ Service accounts + client apps** — `auth-api` (módulo `integrations/`) emite tokens; `zerotrust-api` (módulo `api-access/`) los rutea; `vault-api` marca endpoints con `@ApiClientAllowed`
- **✅ Billing metering** — `auth-api` y `zerotrust-api` reportan usage events a `billing-api` con `actorType`, `sourceService`, `clientAppId`, `serviceAccountId`
- **✅ Notary embebido en `vault-api`** — módulo `notary/` con endpoints tenant-scoped y verificación pública. Paso 1 hacia `notary-api` standalone
- **✅ Tenants con billing sync** — campos `billingBypass`, `maxClientApps`, `maxServiceAccounts` en `Tenant` + short-circuit de entitlements

### Pendiente en este horizonte

- **🟡 Rotar defaults de secretos** — el `docker-compose.yml` usa placeholders `change-me-*`. Falta:
  - Crear `.env.example` en el root con todas las claves listadas
  - Migrar el compose a `${VAR}` con `env_file:` para permitir override sin editar compose
  - Rotar cualquier secreto real en `securechain-vault/infra/.env` (hoy trackeado en git — posible fuga)
- **🟡 Migraciones controladas** — `DB_SYNC=true` está OK para demo local, pero es riesgo para staging/prod. Falta pipeline de migraciones TypeORM por servicio
- **⏭️ Anti-replay persistente** — hoy la ventana anti-replay del HMAC vive en memoria. Rompe con escala horizontal. Mover a Redis o table dedicada
- **⏭️ Hardening HTTP** — `helmet`, rate limiting, CSP en frontends
- **⏭️ Zero Trust admin operable** — hoy `policies.json` es archivo estático. Falta admin por tenant y hot-reload

**Salida esperada:** cuando esto cierra, el stack está listo para el primer cliente piloto sin secretos hardcodeados ni riesgo de replay.

---

## Próximo (Q4 2026) — Separar `notary-api`

**Objetivo:** extraer notary del `vault-api` a un servicio propio. El módulo ya está encapsulado, entonces la extracción es mecánica más que arquitectónica.

Ver [target-state/notary-api.md](./architecture/target-state/notary-api.md).

- **⏭️ Crear repo `notary-api`** — patrón submódulo, mismo que el resto (`ElwinErnst/notary-api`)
- **⏭️ Mover entidades** — `NotaryRecord`, provider refs, historial de certificaciones desde vault-api
- **⏭️ Endpoints propios** — tenant-scoped + público (`/public/notary/verify/:id`)
- **⏭️ Proveedor blockchain real** — reemplazar el anchor client dummy por integración real (Bitcoin OTS, Ethereum, o servicio equivalente)
- **⏭️ Consumo desde `vault-api`** — llamadas HMAC-firmadas, no import directo
- **⏭️ Vista de Notary en `sentinel-app`** — módulo propio en la consola
- **⏭️ Registro en `docker-compose`** + smoke test `./scripts/notary-smoke.sh` apuntando al nuevo servicio

**Precondición:** cerrar la lista de "Ahora" primero. Extraer un servicio sin secretos rotados y sin migraciones controladas es cambiar de auto a mitad de la ruta.

---

## Después (2027+) — Preparar `audit-api`

**Objetivo:** consolidar el trail de auditoría (hoy embebido en `vault-api` como `audit.interceptor` + `audit-hash.util`) como servicio transversal a toda la suite.

Ver [target-state/audit-api.md](./architecture/target-state/audit-api.md).

- **🔮 Crear repo `audit-api`** — sólo cuando 2+ servicios necesiten emitir eventos auditables al mismo trail
- **🔮 Pipeline de ingesta** — desde `auth-api`, `zerotrust-api`, `vault-api`, `billing-api`, `notary-api`
- **🔮 Persistencia append-only con hash chain** — portada del `audit-hash.util` actual
- **🔮 Búsqueda y exportación** — para compliance y análisis forense
- **🔮 Retención configurable por tenant** — parte del plan comercial

**Disparador:** cuando notary-api entre en producción, ya hay 5 servicios generando eventos y separar el trail deja de ser opcional.

---

## Producto y negocio (continuo, en paralelo)

Estos no dependen de los horizontes técnicos y avanzan en paralelo:

### Billing y monetización

- **🟡 Cerrar pricing y métricas de API packs** — la infra ya reporta usage, falta política comercial: cuánto vale cada request al gateway, cada firma notary, cada GB en vault
- **🟡 Stripe real** — hoy hay mock checkout + base Stripe. Migrar a producción con webhooks configurados
- **⏭️ Customer portal Stripe** — self-serve para cambiar plan, actualizar tarjeta, ver facturas
- **⏭️ Modelado de overages** — qué pasa cuando un tenant supera su cuota (bloqueo suave, cargo extra, upgrade forzado)
- **⏭️ Reporting comercial** — dashboards de MRR, churn, uso por plan

### Identity como producto vendible

`auth-api` funciona técnicamente, pero como producto de identidad enterprise le falta:

- **⏭️ MFA** — TOTP como base, WebAuthn como upgrade
- **⏭️ Invite flow sólido** — con expiración, revocación, roles pre-asignados
- **⏭️ Recuperación de contraseña** — con email verification
- **⏭️ Email verification** — al signup
- **🔮 SSO / OIDC / SAML** — cuando el primer cliente enterprise lo pida (y no antes)

### Frontend

- **⏭️ Service accounts / client apps en `sentinel-app`** — hoy sólo se pueden crear vía API
- **⏭️ Bulk actions** en vaults y documentos
- **⏭️ Búsqueda documental** — cuando `vault-api` incorpore indexación
- **⏭️ Narrativa vertical en `sentinel-web`** — mensajes segmentados por fintech / healthtech / legaltech / govtech

---

## Fuera de scope explícito

- **❌ `gateway-bff`** — [target-state](./architecture/target-state/gateway-bff.md) lo marca como "opcional según evolución". No se abre hasta que la orquestación desde `sentinel-app` duela concretamente y sumar un servicio más se justifique frente a la complejidad
- **❌ Almacenamiento genérico** — Sytadel no compite con S3, Drive o Dropbox. Vault es dominio seguro con auditoría y notary, no bucket público
- **❌ Multi-usuario individual** — la unidad comercial es el tenant, siempre. No hay plan "personal"
- **❌ Reescribir el auth como OIDC provider full** — hasta que un cliente lo pague explícitamente

---

## Riesgos abiertos

Del [sytadel-master §6](./architecture/sytadel-master-es.md#6-seguridad-como-eje-del-producto), los que siguen vigentes:

- **HMAC compartido entre ZT y Vault** vs. criptografía asimétrica (rotación de secretos es all-or-nothing hoy)
- **`DB_SYNC=true`** en dev y demo — si se arrastra a staging destruye datos silenciosamente
- **Notary y Audit todavía no desacoplados** — dependencia interna en `vault-api` frena refactors del dominio storage
- **Zero Trust admin muy MVP** — policies como archivo estático, sin admin por tenant

---

## Cómo actualizar este roadmap

- **Cambios de scope:** editar este doc y commitear con `docs(roadmap): ...`
- **Cambios de estado** (⏭️ → 🟡 → ✅): también acá, no sólo en commits de código
- **Nuevos items:** mantener el orden por horizonte, no por urgencia arbitraria
- **Si algo pasa a ❌:** explicar POR QUÉ en el mismo commit, no sólo removerlo
- **Revisión programada:** cada vez que se cierre un horizonte completo (Ahora / Próximo / Después)
