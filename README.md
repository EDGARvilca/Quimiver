# QUIMIVER

Sitio web de **QUIMIVER**, producto de Química Verde Andina.

Hoy es una landing de un solo producto. El pedido se arma en el navegador y se envía por WhatsApp; no hay backend ni base de datos. La arquitectura está pensada para crecer por fases (ver `docs/architecture.md`).

## Requisitos

- Node.js 22 (ver `.nvmrc`)
- npm

## Comandos

| Comando                           | Qué hace                                          |
| --------------------------------- | ------------------------------------------------- |
| `npm install`                     | Instala dependencias                              |
| `npm run dev`                     | Servidor de desarrollo en `http://localhost:4321` |
| `npm run build`                   | Genera el sitio estático en `dist/`               |
| `npm run preview`                 | Sirve `dist/` localmente                          |
| `npm run lint`                    | ESLint                                            |
| `npm run format` / `format:check` | Prettier                                          |
| `npm run check`                   | Verificación de tipos de Astro y TypeScript       |
| `npm test`                        | Pruebas unitarias (Vitest)                        |

CI (`.github/workflows/ci.yml`) ejecuta lint, formato, tipos, pruebas y build en cada PR y en `main`.

## Publicación

Cada push a `main` publica el sitio en GitHub Pages (`.github/workflows/pages.yml`), en https://edgarvilca.github.io/Quimiver/. Requiere que en **Settings → Pages → Build and deployment** el origen sea **GitHub Actions** (se configura una sola vez). Para usar un dominio propio, configúralo en esa misma página; el workflow toma la URL y la subcarpeta automáticamente.

## Variables de entorno

Copia `.env.example` a `.env` si necesitas definirlas.

| Variable    | Uso                                                                   |
| ----------- | --------------------------------------------------------------------- |
| `SITE_URL`  | Opcional. URL pública sin barra final; activa `canonical` y `og:url`. |
| `BASE_PATH` | Opcional. Subcarpeta donde se sirve el sitio (p. ej. `/Quimiver`).    |

## Rutas

| Ruta                          | Contenido                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `/`                           | Landing con formulario de pedido                                               |
| `/productos/<id>/`            | Página de cada producto de `src/content/products` (hoy `/productos/quimiver/`) |
| `/contacto/`                  | Canales de contacto                                                            |
| `/envios/`                    | Cómo comprar, precios, entregas y pagos                                        |
| `/cambios-y-devoluciones/`    | Política de cambios y devoluciones (Ley 29571)                                 |
| `/politica-de-privacidad/`    | Política de privacidad (Ley 29733)                                             |
| `/libro-de-reclamaciones/`    | Libro de Reclamaciones virtual (se anuncia solo con datos legales completos)   |
| `/sitemap.xml`, `/robots.txt` | Generados al compilar; el sitemap solo lista URLs si existe `SITE_URL`         |

Las páginas fijas están en `src/config/pages.ts` (menú, pie y sitemap las leen de ahí). Los enlaces internos usan `withBase()` (`src/lib/paths.ts`) para funcionar también bajo `/Quimiver/` en GitHub Pages.

Los datos legales del proveedor (razón social, RUC, domicilio) van en `site.legal` de `src/config/site.ts`; mientras sean `null` no se muestran. Lo mismo con el horario (`site.contact.hours`).

## Dónde se editan los datos

| Qué                                                                                      | Archivo                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------ |
| Producto: textos, presentaciones, precios, imágenes, FAQ, testimonios                    | `src/content/products/quimiver.json` |
| Teléfono, WhatsApp, correo, redes, envíos, métodos de pago, mínimo para precio por mayor | `src/config/site.ts`                 |
| Colores y medidas                                                                        | `src/styles/_tokens.scss`            |

El archivo de producto se valida al compilar con el esquema de `src/content.config.ts`: si falta un campo o un precio no es válido, el build falla.

### Contenido pendiente de verificación

Las afirmaciones que necesitan respaldo del negocio (propiedades de salud, certificaciones, composición y testimonios) tienen `"verified": false` en el JSON. Mientras sea así, el sitio no las publica: la sección o el texto simplemente no aparece (si no queda ningún beneficio o testimonio verificado, se oculta la sección completa).

Para publicar una afirmación, confirma que existe respaldo (registro sanitario, certificado, autorización del cliente para su testimonio, etc.) y cambia su valor a `"verified": true`.

Las redes sociales en `src/config/site.ts` tienen `url: null` hasta que se definan las cuentas oficiales.

### Frasco girando (secuencia de fotos)

En la portada, la foto real del frasco gira en 3D al bajar. Para que dé la vuelta completa con fotos reales:

1. Guarda las fotos en `public/images/giro/` como `giro-01.webp` … `giro-36.webp` (mismo tamaño todas, unos 800 px de ancho).
2. Agrega en `images` de `quimiver.json`:

```json
"spin": { "pattern": "/images/giro/giro-{n}.webp", "frames": 36, "width": 800, "height": 600 }
```

Los cuadros se descargan solo cuando la sección está por aparecer, así que no frenan la carga inicial.

## Registro de pedidos

Al confirmar el formulario de compra, el sitio guarda una copia numerada del pedido (`P-000001`) y luego abre WhatsApp con el mensaje, que ya incluye ese número. Si el registro falla o tarda más de 4 segundos, WhatsApp se abre igual: nunca se pierde la venta.

- Servidor: Edge Function `pedidos` (`supabase/functions/pedidos/`), validación en `pedido.ts` (la usan el servidor y las pruebas).
- Tabla `pedidos` (migración en `supabase/migrations/`). Los montos son la estimación que vio el cliente; el precio final y el envío se confirman por WhatsApp.
- Para ver los pedidos: Supabase → Table Editor → `pedidos`. Cambia la columna `estado` (`nuevo`, `confirmado`, `pagado`, `enviado`, `entregado`, `cancelado`) y usa `notas_internas` para el seguimiento.
- Aviso por correo de cada pedido: se activa solo con los mismos secretos de Brevo del libro (`BREVO_API_KEY`, `MAIL_FROM`); llega al correo de `libro_proveedor` o al del secreto `PEDIDOS_CORREO`.

## Libro de Reclamaciones virtual

Cumple el D.S. 011-2011-PCM y sus modificatorias: cada hoja recibe un número correlativo (`LR-000001`), fecha y hora, se guarda al menos 2 años y se envía por correo al consumidor y al negocio. El plazo de respuesta es de 15 días hábiles.

- Formulario: `src/pages/libro-de-reclamaciones.astro` y `src/scripts/complaints-form.ts`.
- Reglas de la hoja (compartidas por el sitio, el servidor y las pruebas): `supabase/functions/libro-reclamaciones/complaint.ts`.
- Servidor: Edge Function `libro-reclamaciones` en el proyecto Supabase `quimiver` (São Paulo). Tablas en `supabase/migrations/`.
- `.github/workflows/libro-keepalive.yml` consulta el servidor dos veces por semana para que el proyecto gratuito no se pause.

### Cómo activarlo

1. **Datos del proveedor**, en dos lugares:
   - `site.legal` de `src/config/site.ts` (razón social, RUC, domicilio). Con eso aparecen la página, el enlace y el aviso en el pie.
   - En Supabase → Table Editor → `libro_proveedor`, la misma razón social, RUC y domicilio. Sin ellos el servidor responde "no habilitado".
2. **Correo** (opcional pero recomendado, la norma pide enviar la copia): crea una cuenta en Brevo, verifica el remitente y en Supabase → Edge Functions → Secrets agrega `BREVO_API_KEY` y `MAIL_FROM`. Nunca pongas estas claves en el código. Sin ellas la hoja se guarda y el cliente puede imprimirla, pero no sale el correo.
3. Si el sitio cambia de dominio, agrega la dirección nueva en el secreto `ALLOWED_ORIGINS` (lista separada por comas) y en `sitio_web` de `libro_proveedor`.

### Cómo responder

En Supabase → Table Editor → `reclamos` aparecen las hojas. Responde al correo del cliente dentro de 15 días hábiles y anota la respuesta en `acciones_proveedor` y la fecha en `respondido_en`.

## Estructura

```
src/
├── components/      Secciones de la página (Astro, sin JS salvo el formulario)
├── config/site.ts   Configuración central del negocio
├── content/         Datos de productos (JSON)
├── content.config.ts Esquema de los datos
├── layouts/         Layout base con SEO
├── lib/order.ts     Lógica pura del pedido (total y mensaje)
├── pages/           Rutas
├── scripts/         Código de navegador (formulario de pedido)
└── styles/          SCSS global y tokens
supabase/            Base de datos y servidor del Libro de Reclamaciones
tests/               Pruebas unitarias
docs/                Documentación técnica
```

## Convenciones

- Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Reglas del proyecto: QUIMIVER Master Skill (no inventar datos de producto, analizar antes de cambiar, etc.).
