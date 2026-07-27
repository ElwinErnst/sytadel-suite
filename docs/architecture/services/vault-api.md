# vault-api

**Estado:** implementado y más maduro del stack

## Propósito
Gestionar el dominio documental sensible: vaults, documentos, cifrado, storage orchestration, auditoría y verificación de contexto firmado.

## Frontera
`vault-api` no debería ser dueño de autenticación ni de memberships. Su dominio es el documento y su ciclo de vida seguro.

## Responsabilidades
- crear y listar vaults
- upload, download y delete de documentos
- cifrado de documentos antes de persistir
- manejo de claves por tenant
- auditoría append-only
- validación de requests firmadas por Zero Trust
- notary MVP embebido mientras no exista `notary-api`

## Datos y ownership
Es dueño de:
- vaults
- documents
- tenant keys
- audit logs locales del dominio Vault
- metadata de cifrado e integridad documental

No debería ser dueño de:
- users
- memberships
- billing
- sesiones

## Integraciones
- consume directorio y memberships desde `auth-api`
- confía en `zerotrust-api` para acceso firmado
- usa MinIO para storage
- usa PostgreSQL para metadata

## Seguridad
- cifrado documental
- firma y validación de contexto Zero Trust
- separación por tenant
- auditoría encadenada

Riesgos actuales:
- notary todavía embebido
- lifecycle documental todavía básico
- búsqueda y metadata todavía limitadas
- modelo de integración API todavía en evolución

## Estado actual
### Implementado
- CRUD esencial documental
- cifrado y storage
- RBAC por tenant vía `auth-api`
- auditoría del dominio
- verificación pública de integridad

### Parcial
- notary como módulo MVP
- operaciones documentales más ricas
- metadata avanzada y búsqueda

## Gaps
- versionado serio
- lifecycle documental completo
- retención, archive, legal hold
- separación limpia de `notary-api`
- separación futura de `audit-api`

## Próximo estado esperado
Quedar enfocado como servicio documental seguro, con notary y audit desacoplados, sin volver a absorber responsabilidades de identidad o gateway.
