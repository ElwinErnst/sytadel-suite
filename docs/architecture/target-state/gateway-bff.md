# gateway-bff

**Estado:** objetivo futuro / opcional según evolución

## Propósito
Consolidar la experiencia frontend y la orquestación de APIs cuando el número de servicios y pantallas haga conveniente una capa de agregación orientada a cliente.

## Frontera
No debe reemplazar a Zero Trust ni absorber lógica de dominio. Su rol sería adaptar respuestas y coordinar experiencia de frontend.

## Responsabilidades
- agregación de respuestas para frontend
- simplificación de contratos para la app
- reducción de round-trips
- composición de vistas complejas

## Datos y ownership
No debería ser dueño de datos primarios. Debe consumirlos desde los servicios de dominio.

## Integraciones
- sentinel-app
- auth-api
- billing-api
- zerotrust-api
- futuros servicios desacoplados

## Seguridad
- nunca debe relajar la frontera Zero Trust
- no debe exponer caminos alternativos hacia Vault o dominios sensibles

## Estado actual
Hoy no existe un BFF separado. La app consume directamente varios servicios.

## Gaps
- definir si realmente aporta valor frente a la arquitectura actual
- evitar agregar complejidad sin necesidad

## Próximo estado esperado
Solo debería aparecer si la complejidad del frontend o la cantidad de servicios lo justifica claramente.
