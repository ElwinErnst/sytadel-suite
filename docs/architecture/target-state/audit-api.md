# audit-api

**Estado:** objetivo futuro

## Propósito
Consolidar el trail de auditoría como un servicio separado, capaz de recibir eventos desde múltiples dominios y ofrecer una visión más fuerte de cumplimiento y observabilidad.

## Frontera
`audit-api` no debería ejecutar negocio operativo. Su rol es registrar, encadenar, consultar y eventualmente exportar eventos.

## Responsabilidades
- ingesta de eventos
- persistencia append-only
- encadenado/hash de eventos
- búsqueda y exportación
- retención y reporting

## Datos y ownership
Debe ser dueño de:
- eventos de auditoría
- hashes de cadena de auditoría
- metadatos de observabilidad y cumplimiento

## Integraciones
- Auth
- Zero Trust
- Vault
- Billing
- Notary

## Seguridad
- debe preservar integridad del trail
- no debe poder ser reescrito silenciosamente
- es un componente clave para compliance y análisis forense

## Estado actual
Hoy la auditoría existe principalmente dentro de `vault-api` y en narrativa de plataforma, pero no está separada como servicio.

## Gaps
- servicio desacoplado
- pipeline de eventos multi-servicio
- exportación y reporting más fuertes

## Próximo estado esperado
Ser la base de auditoría y cumplimiento transversal de toda la suite.
