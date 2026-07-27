# zerotrust-api

**Estado:** implementado / parcial como producto

## Propósito
Actuar como gateway Zero Trust delante de los servicios sensibles, validando identidad, aplicando políticas y firmando contexto downstream.

## Frontera
`zerotrust-api` no debería ser dueño de identidad persistida ni de storage documental. Su función es enforcement y control de acceso.

## Responsabilidades
- validar JWT de `auth-api`
- resolver upstreams
- evaluar políticas por ruta, método, upstream y rol
- firmar requests downstream
- proteger `vault-api`
- diferenciar tráfico humano de tráfico técnico/API client

## Datos y ownership
Es dueño de:
- decisiones de policy en runtime
- configuración de upstreams y políticas del gateway

No debería ser dueño de:
- users o sessions
- documentos o almacenamiento
- billing

## Integraciones
- consume JWT de `auth-api`
- consulta entitlements y contexto desde `auth-api`
- protege `vault-api`
- será pieza crítica para futuras integraciones API

## Seguridad
- valida JWT
- firma contexto downstream con HMAC
- aplica anti-replay básico
- reduce exposición directa del dominio Vault

Riesgos actuales:
- policies todavía muy MVP
- administración todavía muy local y limitada
- HMAC compartido en vez de firma asimétrica
- observabilidad y operación aún inmaduras

## Estado actual
### Implementado
- gateway catch-all
- policy básica por upstream/path/method/role
- signed headers `x-zt-*`
- enforcement hacia Vault
- bloqueo de `Vault API Pack` para clientes API sin add-on

### Parcial
- modelo de producto Zero Trust vendible y administrable
- política multi-tenant configurable por cliente
- soporte multi-upstream más robusto

## Gaps
- policies custom por tenant
- service accounts y client apps explícitos
- métricas y troubleshooting operativos
- administración segura remota
- paso de HMAC a criptografía asimétrica

## Próximo estado esperado
Convertirse en una verdadera capa de enforcement multi-servicio, con políticas configurables, observabilidad operativa y mejor separación entre tráfico humano del workspace y tráfico programático de clientes.
