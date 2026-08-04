# Sytadel: documento maestro de producto, seguridad y arquitectura

## 1. Visión general de Sytadel
Sytadel es una plataforma B2B SaaS de infraestructura de confianza digital para organizaciones que gestionan información sensible y necesitan control operativo, trazabilidad, acceso seguro y evidencia verificable.

El producto no se posiciona como almacenamiento genérico ni como un simple proveedor de autenticación. Su propuesta es dar una base operativa confiable para trabajar con identidad, acceso, documentos sensibles, políticas de seguridad y evidencia auditable dentro de una misma plataforma.

Sytadel se concibe como una suite modular. El cliente compra un workspace principal, capacidades por plan y, cuando corresponde, API packs para integrar la plataforma dentro de sus propias aplicaciones.

## 2. Qué problema resuelve
Muchas empresas crecen con permisos dispersos, documentos críticos sin trazabilidad fuerte, controles administrativos poco claros y procesos sensibles apoyados en confianza implícita.

Sytadel busca resolver eso unificando:
- identidad multi-tenant
- control de acceso Zero Trust
- resguardo documental seguro
- auditoría operativa
- verificación de integridad
- un modelo comercial SaaS modular orientado a equipos B2B

El resultado esperado es que una organización pueda operar con menos exposición, más claridad de acceso, mejor capacidad de auditoría y una base más segura para procesos críticos.

## 3. Producto y modelo SaaS
### Qué vendemos hoy
Hoy Sytadel vende principalmente:
- un workspace operativo para organizaciones
- gestión segura de acceso e identidad
- capacidades de Vault para documentos sensibles
- capas de Zero Trust para proteger el acceso al dominio documental
- facturación por tenant con planes y add-ons

### Qué venderemos de forma más clara a medida que madure
La arquitectura y el roadmap apuntan a vender una suite modular compuesta por:
- Auth
- Zero Trust
- Vault
- Notary
- Audit
- API packs para integraciones

### Unidad comercial
La unidad comercial y de facturación es el tenant, no el usuario individual.

### Estructura comercial vigente
- plan base del workspace
- add-ons de capacidad
- API packs para integraciones programáticas
- futura expansión a módulos premium más explícitos por dominio

### Enfoque B2B
El producto está orientado a:
- fintechs
- healthtechs
- legaltechs
- govtechs
- empresas SaaS y equipos con requerimientos de trazabilidad y control

El lenguaje comercial correcto no es “más almacenamiento”, sino “más control, acceso seguro, evidencia y continuidad operativa”.

## 4. Panorama del stack actual
### Componentes actuales
Hoy el stack implementado en el repo se compone de:
- `auth-api`: identidad, tenants, memberships, sesiones y entitlements
- `zerotrust-api`: gateway Zero Trust y enforcement de acceso hacia upstreams
- `vault-api`: dominio documental, cifrado, auditoría, verificación de requests firmadas y notary embebido MVP
- `billing-api`: suscripciones, catálogo, checkout self-serve y sync de plan hacia auth
- `sytadel-app`: consola operativa del cliente
- `sytadel-web`: sitio comercial y de marketing

### Dependencias de infraestructura visibles hoy
- PostgreSQL para `auth`, `billing` y `vault`
- MinIO para almacenamiento de documentos
- Docker Compose como stack de desarrollo

### Flujo operativo principal actual
1. El usuario hace login contra `auth-api`.
2. `auth-api` emite JWT y resuelve el contexto del tenant.
3. El cliente llama a `zerotrust-api`.
4. `zerotrust-api` valida JWT, aplica policy y firma la request hacia el upstream.
5. `vault-api` acepta solo requests firmadas por Zero Trust y opera sobre documentos, vaults y auditoría.
6. `billing-api` administra planes y add-ons del tenant y sincroniza entitlements con `auth-api`.

## 5. Arquitectura objetivo
La arquitectura objetivo no es idéntica al estado actual. El destino natural del producto es una separación más clara de dominios.

### Objetivo futuro
- `auth-api` como capa de identidad y directorio
- `zerotrust-api` como policy enforcement y control de acceso
- `vault-api` como dominio exclusivo de almacenamiento documental seguro
- `notary-api` como servicio separado de evidencia e integridad
- `audit-api` como servicio separado de trail de auditoría y eventos
- `billing-api` como servicio comercial y de suscripciones
- `sytadel-app` como consola principal del cliente
- `sytadel-web` como frente comercial
- posible `gateway/BFF` cuando la orquestación frontend necesite consolidación adicional

### Principio arquitectónico central
Cada servicio debe tener una frontera clara y un ownership explícito sobre su dominio. El objetivo no es solo modularidad técnica; es reducir la posibilidad de comprometer datos, mezclar responsabilidades o volver difuso el modelo de confianza del sistema.

## 6. Seguridad como eje del producto
La seguridad no es una feature secundaria. Es la razón estructural del producto.

### Principios no negociables
- confianza mínima entre componentes
- separación clara de responsabilidades por servicio
- no exposición directa de `vault-api` como superficie pública recomendada
- validación de identidad antes de operación
- trazabilidad por tenant y por acción
- cifrado de documentos y manejo controlado de claves
- integridad verificable cuando el caso de uso lo requiere
- auditoría de operaciones sensibles
- enforcement consistente entre backend y frontend

### Lo que hoy ya existe y suma valor real
- multi-tenancy con `auth-api` como fuente de verdad
- JWT con issuer/audience
- Zero Trust como gateway delante de Vault
- firmas HMAC downstream entre gateway y Vault
- cifrado de documentos en `vault-api`
- auditoría encadenada en Vault
- separación funcional real entre identidad, gateway y dominio documental
- entitlements por tenant con integración de billing
- gating real de API add-ons para clientes técnicos

### Riesgos actuales del MVP
- secretos por defecto en entorno local
- HMAC compartido entre Zero Trust y Vault en lugar de criptografía asimétrica
- `DB_SYNC=true` en entornos de desarrollo y demo
- mecanismos anti-replay en memoria
- hardening HTTP todavía parcial
- notary todavía no desacoplado como servicio separado
- audit todavía no separado como servicio dedicado
- Zero Trust todavía con administración muy MVP y poco operable

### Regla de producto
El MVP puede estar incompleto, pero no debería violar aislamiento por tenant, control del acceso, integridad documental o trazabilidad operativa.

## 7. Estado actual: qué hay, qué falta, qué está en proceso
### auth-api
**Estado:** implementado, con piezas todavía parciales para identidad enterprise.

Existe hoy:
- usuarios
- tenants
- memberships
- login, refresh, logout, logout-all
- sesiones
- entitlements por tenant
- endpoints internos consumidos por otros servicios

Falta o está parcial:
- MFA
- invite flow sólido
- recuperación de contraseña
- email verification
- SSO / OIDC / SAML
- postura más completa como producto de identidad vendible

### zerotrust-api
**Estado:** implementado como gateway técnico, parcial como producto operable.

Existe hoy:
- validación de JWT
- policies por upstream/path/method/role
- firmado downstream hacia Vault
- enforcement básico
- admin local para status/policies/upstreams

Falta o está parcial:
- policies por tenant administrables
- observabilidad operativa rica
- mejor experiencia de administración
- modelo enterprise de Zero Trust como producto configurable

### vault-api
**Estado:** implementado y es el componente más maduro del stack.

Existe hoy:
- vaults
- upload/download/delete de documentos
- cifrado
- storage orchestration con MinIO
- claves por tenant
- auditoría append-only
- integración con Zero Trust y Auth
- verificación pública de anchors
- notary MVP embebido

Falta o está parcial:
- versionado documental serio
- metadata y lifecycle más ricos
- búsqueda/indexación
- notary separado como servicio
- ACL documental más fina si se quiere ir a casos más complejos

### billing-api
**Estado:** implementado y en proceso de maduración comercial.

Existe hoy:
- catálogo de planes
- suscripciones por tenant
- checkout mock y base Stripe
- sync de plan hacia auth
- add-ons reales a nivel de billing
- API packs comprables

Falta o está parcial:
- usage-based billing más fino
- reporting comercial más rico
- customer portal maduro si Stripe queda como provider principal
- modelado final de overages
- alineación completa entre compra, métricas y producto vendido

### sytadel-app
**Estado:** implementado como consola MVP usable.

Existe hoy:
- login
- overview
- memberships
- vaults
- documentos
- auditoría
- settings
- facturación
- gating por plan y add-ons

Falta o está parcial:
- mejor experiencia de policies Zero Trust
- service accounts / client apps para APIs
- experiencia más madura de invitaciones, búsquedas, bulk actions y operación documental
- vista de Notary como módulo propio cuando se desacople

### sytadel-web
**Estado:** implementado y funcional como frente comercial.

Existe hoy:
- narrativa de producto
- pricing público por tiers
- explicación de API packs
- contacto comercial
- branding Sytadel

Falta o está parcial:
- narrativa todavía más afinada para públicos específicos
- assets comerciales más fuertes
- material de confianza social y prueba de mercado
- evolución hacia una propuesta más precisa por vertical sin sobrecargar la landing

## 8. Riesgos, decisiones y prioridades
### Decisiones correctas ya tomadas
- `auth-api` como fuente de verdad de tenants y memberships
- `zerotrust-api` como capa de acceso delante de Vault
- `vault-api` como dominio fuerte de documentos y no de identidad
- el tenant como unidad comercial y de facturación
- los API packs como add-ons y no como parte automática de todos los planes

### Prioridades recomendadas
#### Prioridad 1: seguridad base y coherencia de producto
- eliminar defaults inseguros para entornos serios
- formalizar migraciones controladas
- endurecer Zero Trust y observabilidad
- cerrar el modelo de clientes API / service accounts

#### Prioridad 2: consolidación de dominios
- separar `notary-api`
- preparar `audit-api`
- dejar `vault-api` más concentrado en storage/document lifecycle

#### Prioridad 3: producto y negocio
- cerrar pricing y métricas de API packs
- madurar billing real en Stripe
- terminar de alinear experiencia de app con capacidad real del backend

### Panorama general
Sytadel ya tiene una base mejor que la de un MVP convencional. No es todavía un producto enterprise endurecido, pero sí una plataforma con una arquitectura de seguridad creíble, una frontera de servicios coherente y una dirección clara de producto B2B SaaS.

La clave no es agregar muchas features dispersas. La clave es consolidar las fronteras, endurecer seguridad operativa, separar mejor dominios y hacer que la narrativa comercial refleje con precisión lo que el producto realmente protege y habilita.
