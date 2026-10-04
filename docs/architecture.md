# Arquitectura

## Estado actual

Sitio estático generado con **Astro**. No hay servidor de aplicación ni base de datos.

```
src/content/products/*.json ──┐
src/config/site.ts ───────────┼──> src/pages/index.astro ──> dist/index.html
src/components/*.astro ───────┘                                   │
                                                                  ▼
                                     src/scripts/order-form.ts (navegador)
                                                                  │
                                                                  ▼
                                            https://wa.me/<número>?text=<pedido>
```

- **Datos**: un producto por archivo JSON, validado con Zod en `src/content.config.ts`.
- **Configuración**: contacto, envíos y pagos en `src/config/site.ts`.
- **Interactividad**: solo el formulario de pedido carga JavaScript. La lógica de cálculo y armado del mensaje está en `src/lib/order.ts`, sin dependencias del DOM, y tiene pruebas.
- **Pedido**: el total es una estimación para el cliente. El pedido no se registra en ningún sistema; se confirma por WhatsApp.

## Limitaciones conocidas

- El navegador calcula el total; no hay validación de servidor porque no hay servidor. El precio definitivo se confirma manualmente.
- No hay registro de pedidos, clientes ni inventario.
- Las imágenes son referenciales de Unsplash y se cargan desde su CDN.

## Evolución prevista

Ver el plan de fases de la auditoría inicial. El siguiente paso estructural, cuando el negocio necesite registrar pedidos o administrar productos, es añadir una API Node.js + TypeScript con PostgreSQL (monolito modular) y mover la fuente de verdad de precios e inventario al backend. Ese cambio requiere autorización previa.
