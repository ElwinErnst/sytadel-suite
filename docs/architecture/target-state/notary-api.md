# notary-api

**Estado:** objetivo futuro

## Propósito
Separar la emisión de evidencia e integridad documental del dominio de storage para convertir Notary en un servicio propio.

## Frontera
`notary-api` no debería ser dueño del archivo ni del lifecycle documental completo. Su foco es la evidencia, la certificación y la verificación.

## Responsabilidades
- emisión de records notariales
- verificación de integridad
- historial de certificaciones
- provider blockchain o equivalente
- estado de certificación por documento o evidencia

## Datos y ownership
Debe ser dueño de:
- notary records
- provider refs
- estados de emisión y verificación

No debería ser dueño de:
- archivos originales
- membresías
- sesiones

## Integraciones
- consume hashes o referencias desde Vault
- se apoya en Auth/entitlements para saber quién puede emitir
- se integra con Audit para trazabilidad

## Seguridad
- integridad y evidencia son su eje
- debe evitar mezclar storage con notary
- debe mantener verificabilidad incluso si el workspace deja de estar activo

## Estado actual
Hoy existe solo de forma parcial dentro de `vault-api` como módulo embebido.

## Gaps
- entidad propia de notary records
- proveedor real en lugar de dummy
- endpoints y lifecycle desacoplados

## Próximo estado esperado
Convertirse en un servicio autónomo de evidencia digital dentro de la suite.
