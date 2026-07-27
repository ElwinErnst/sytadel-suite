# auth-api

**Estado:** implementado

## Propósito
Ser la autoridad de identidad, directorio multi-tenant y entitlements de la plataforma.

## Frontera
`auth-api` es dueño de identidad y organización. No debería convertirse en el dueño de documentos, notary, storage ni lógica comercial profunda de frontend.

## Responsabilidades
- usuarios
- tenants
- memberships
- sesiones
- login, refresh, logout y logout-all
- emisión de JWT
- entitlements efectivos por tenant
- endpoints internos para otros servicios

## Datos y ownership
Es dueño de:
- users
- tenants
- tenant memberships
- sessions
- plan base y flags efectivos del tenant
- API add-ons persistidos como parte del perfil del tenant

No debería ser dueño de:
- documentos
- vaults
- hashes o evidencia documental
- política comercial detallada de frontend

## Integraciones
- integra con `zerotrust-api` como issuer del JWT
- integra con `vault-api` como directorio interno
- integra con `billing-api` para sincronizar plan y add-ons
- es consumido por `sentinel-app`

## Seguridad
- JWT con issuer y audience
- sesiones y refresh tokens
- fuente de verdad multi-tenant
- control de acceso por membership

Riesgos actuales:
- falta hardening identity más enterprise
- faltan MFA, recovery, invite flows sólidos y SSO
- defaults inseguros en desarrollo no deben migrar a producción

## Estado actual
### Implementado
- login / refresh / logout / me
- users / tenants / memberships
- endpoints internos server-to-server
- entitlements por tenant
- sync de add-ons desde billing

### Parcial
- identidad como producto comercial vendible
- modelo de permisos más granular
- historias de lifecycle de usuario final

## Gaps
- MFA
- password reset
- verificación de email
- SSO / OIDC / SAML
- gestión de apps cliente / service accounts si Auth API va a venderse formalmente como pack

## Próximo estado esperado
Evolucionar hacia una capa de identidad más fuerte, apta para vender Auth como capacidad de plataforma, sin absorber dominios que pertenecen a Zero Trust, Vault o Billing.
