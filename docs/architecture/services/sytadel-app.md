# sytadel-app

**Estado:** implementado / MVP usable

## Propósito
Ser la consola principal del cliente para operar el workspace de Sytadel.

## Frontera
`sytadel-app` no es el dueño del negocio ni de la seguridad. Debe reflejar capacidades reales del backend, no inventarlas ni exponer controles que contradigan billing o entitlements.

## Responsabilidades
- login y sesión segura
- overview del tenant
- gestión básica de memberships
- gestión de vaults y documentos
- auditoría visible
- configuración del tenant y del usuario
- facturación y upgrades

## Datos y ownership
No es dueño de datos críticos; consume y presenta:
- identidad y entitlements de `auth-api`
- facturación de `billing-api`
- operaciones documentales vía `zerotrust-api` y `vault-api`

## Integraciones
- `auth-api`
- `billing-api`
- `zerotrust-api`
- indirectamente `vault-api`

## Seguridad
- cookies `httpOnly`
- gating por plan, rol y entitlements
- no debe filtrar capacidades que el backend no soporta

Riesgos actuales:
- algunas pantallas todavía tienen profundidad MVP
- faltan experiencias más maduras para APIs, policies y módulos futuros

## Estado actual
### Implementado
- login
- overview
- acceso y memberships
- vaults y documentos
- auditoría
- settings
- facturación con add-ons

### Parcial
- UX de operación más enterprise
- consola clara para APIs y Zero Trust
- service accounts / client apps
- módulos futuros como Notary y Audit desacoplados

## Gaps
- invitaciones y búsquedas más maduras
- mejor consola para policies
- mejor vista para módulos premium y API packs
- operación más rica para clientes B2B técnicos

## Próximo estado esperado
Ser una consola más consistente y comercialmente madura, donde el cliente entienda qué compró, qué puede operar y cómo usar la plataforma sin exponerse a lenguaje interno del equipo.
