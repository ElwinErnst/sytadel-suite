# Documentación Integral de Sytadel

Este paquete documenta el estado actual del stack, la arquitectura objetivo y la narrativa de producto de Sytadel con foco en seguridad de datos, producto B2B y modelo SaaS.

## Documento maestro
- [Documento maestro de producto y arquitectura](./sytadel-master-es.md)
- [Glosario común](./glossary.md)

## Fichas por servicio y proyecto actual
- [auth-api](./services/auth-api.md)
- [zerotrust-api](./services/zerotrust-api.md)
- [vault-api](./services/vault-api.md)
- [billing-api](./services/billing-api.md)
- [sytadel-app](./services/sytadel-app.md)
- [sytadel-web](./services/sytadel-web.md)

## Fichas de arquitectura objetivo
- [notary-api](./target-state/notary-api.md)
- [audit-api](./target-state/audit-api.md)
- [gateway-bff](./target-state/gateway-bff.md)

## Regla editorial
En toda esta documentación se separa explícitamente:
- lo implementado hoy
- lo parcial o en proceso
- lo que es arquitectura objetivo

Si existe contradicción entre documentación histórica y repo actual, prevalece primero el estado real del código y segundo las decisiones recientes del producto.
