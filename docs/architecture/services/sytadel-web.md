# sytadel-web

**Estado:** implementado

## Propósito
Presentar Sytadel como producto B2B SaaS, explicar valor, atraer leads y orientar al cliente hacia la app o hacia contacto comercial.

## Frontera
`sytadel-web` no debe actuar como consola operativa ni como lugar de configuración avanzada. Su rol es comercial, narrativo y de adquisición.

## Responsabilidades
- narrativa de producto
- propuesta de valor
- pricing por tiers
- explicación de API packs
- contacto comercial
- posicionamiento de marca

## Datos y ownership
No es dueño de datos operativos del cliente. Solo expone contenido de marketing, pricing y conversión.

## Integraciones
- vínculo con `sytadel-app`
- apoyo narrativo al modelo de `billing-api`
- consistencia con la arquitectura real del producto

## Seguridad
- no maneja datos sensibles del core operativo
- debe evitar exponer internals innecesarios
- su narrativa debe ser fiel al producto real para no generar promesas inseguras o engañosas

## Estado actual
### Implementado
- landing multilenguaje
- narrativa de tiers
- explicación de API packs
- branding Sytadel
- despliegue en Vercel

### Parcial
- narrativa más profunda por industria
- prueba social y assets comerciales más completos
- material ejecutivo más robusto

## Gaps
- contenido por vertical más rico
- assets comerciales de confianza
- evolución hacia una propuesta más fuerte de producto enterprise

## Próximo estado esperado
Ser la puerta comercial clara del producto, alineada con lo que realmente existe en la plataforma y con una narrativa enfocada en seguridad operativa, trazabilidad y continuidad.
