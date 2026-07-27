# billing-api

**Estado:** implementado / en proceso

## Propósito
Gestionar la capa comercial y de suscripciones del tenant: catálogo, suscripción, checkout, add-ons y sync de capacidades hacia el resto del producto.

## Frontera
`billing-api` no debería ser dueño de identidad ni de autorización de runtime. Su rol es comercial y contractual.

## Responsabilidades
- catálogo de planes
- catálogo de API packs
- suscripciones por tenant
- checkout self-serve
- integración con Stripe o modo mock
- persistencia de add-ons
- sync del estado comercial hacia `auth-api`

## Datos y ownership
Es dueño de:
- billing customers
- billing subscriptions
- estado comercial de la suscripción
- add-ons contratados

No debería ser dueño de:
- users
- memberships
- documentos
- decisiones de policy de acceso en runtime

## Integraciones
- sincroniza plan y add-ons con `auth-api`
- es consumido por `sentinel-app`
- está alineado con la narrativa comercial de `sentinel-web`

## Seguridad
- maneja información comercial sensible
- debe validar fuertemente ownership del tenant
- debe evitar que un usuario compre para un tenant incorrecto

Riesgos actuales:
- Stripe todavía parcial según entorno
- usage-based billing todavía no cerrado
- todavía falta converger mejor compra, métrica y enforcement de producto

## Estado actual
### Implementado
- catálogo
- suscripción por tenant
- API add-ons reales
- sync a `auth-api`
- base para Stripe

### Parcial
- medición de uso y overages
- customer portal maduro
- reporting comercial

## Gaps
- métricas de consumo por add-on
- pricing final de API packs
- contratos comerciales más finos por vertical y tier
- soporte enterprise más diferenciado

## Próximo estado esperado
Convertirse en la capa comercial estable del producto SaaS, capaz de mapear plan, add-ons y consumo en capacidades reales del tenant sin mezclar lógica de negocio operacional con facturación.
