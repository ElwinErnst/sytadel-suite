# Glosario de Sytadel

## Tenant
Unidad comercial y operativa principal del producto. Representa a una empresa, organización o cliente dentro de Sytadel.

## Workspace
Experiencia de uso que el cliente ve dentro de la app. Normalmente corresponde al tenant activo y a sus capacidades.

## Plan
Paquete base contratado por un tenant. Define límites y capacidades generales del workspace.

## Add-on
Capacidad adicional comprada por encima del plan base.

## API Pack
Add-on comercial que habilita acceso programático a capacidades específicas de la plataforma. Hoy aplica a Auth API, Vault API y Zero Trust API.

## Servicio interno
Microservicio que forma parte del stack y que no debería exponerse directamente a clientes sin pasar por los controles adecuados.

## Superficie pública
Endpoints, interfaz web o componentes que el cliente consume directamente.

## Target architecture
Arquitectura objetivo del producto, separada del estado actual del MVP. Representa el destino deseado, no necesariamente lo ya implementado.

## MVP
Versión mínima viable del producto. En Sytadel, el MVP debe seguir respetando seguridad de acceso, aislamiento por tenant, trazabilidad y protección del dato.
