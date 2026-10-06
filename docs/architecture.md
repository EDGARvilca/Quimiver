# Arquitectura

## Estado actual

Sitio estático generado con **Astro** y publicado en GitHub Pages. Lo que necesita guardarse (pedidos y hojas del Libro de Reclamaciones) va a **Supabase**: PostgreSQL más dos Edge Functions en TypeScript. El sitio nunca escribe directo en la base; siempre pasa por una función que valida.

```
Navegador (GitHub Pages)                      Supabase (São Paulo)
────────────────────────                      ───────────────────────────────
Formulario de pedido ── POST ──> Edge Function pedidos ──────────> tabla pedidos
        │                                                               ▲
        └── abre WhatsApp con el pedido y su número (P-000001)          │
                                                                        │
Libro de Reclamaciones ── POST ──> Edge Function libro-reclamaciones ─> tabla reclamos
                                        └── copia por correo (Brevo, opcional)
                                                                        │
Panel /panel/ ── Supabase Auth (correo y contraseña) ── REST + RLS ─────┘
                 solo correos de la tabla administradores
```

- **Datos del producto**: un archivo JSON por producto, validado con Zod en `src/content.config.ts`.
- **Configuración**: contacto, envíos, pagos, datos legales y direcciones de Supabase en `src/config/site.ts`.
- **Lógica sin DOM y con pruebas**: `src/lib/` (pedido, panel, rutas) y la validación compartida entre el sitio y el servidor en `supabase/functions/*/` (`pedido.ts`, `complaint.ts`).
- **Pedido**: el total es una estimación que valida el servidor; el precio final y el envío se confirman por WhatsApp. Si el registro falla, WhatsApp se abre igual.
- **Base de datos**: migraciones en `supabase/migrations/`. RLS activo en todas las tablas; el público no tiene acceso directo a ninguna.

## Limitaciones conocidas

- No hay inventario ni pagos en línea: el stock y el cobro (Yape o Plin) se manejan por WhatsApp.
- GitHub Pages no permite cabeceras HTTP propias; la política de seguridad va en una etiqueta `<meta>` (ver `docs/seguridad.md`).
- Plan gratuito de Supabase: el proyecto se pausa sin actividad (lo evita `libro-keepalive.yml`) y no hay copias de seguridad descargables.

## Evolución prevista

Las fases siguen el plan de la auditoría inicial. Inventario, pagos en línea o administración de productos desde el panel son cambios estructurales y requieren autorización previa.
