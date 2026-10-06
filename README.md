# QUIMIVER

Sitio web de **QUIMIVER**, producto de CELGIMED.

Tienda de un solo producto: el pedido se registra con su número y se confirma por WhatsApp, con Libro de Reclamaciones virtual y un panel privado de pedidos. Arquitectura en `docs/architecture.md` y seguridad en `docs/seguridad.md`.

## Requisitos

- Node.js 22 (ver `.nvmrc`)
- npm

## Comandos

| Comando                           | Qué hace                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| `npm install`                     | Instala dependencias                                       |
| `npm run dev`                     | Servidor de desarrollo en `http://localhost:4321`          |
| `npm run build`                   | Genera el sitio estático en `dist/`                        |
| `npm run preview`                 | Sirve `dist/` localmente                                   |
| `npm run lint`                    | ESLint                                                     |
| `npm run format` / `format:check` | Prettier                                                   |
| `npm run check`                   | Verificación de tipos de Astro y TypeScript                |
| `npm test`                        | Pruebas unitarias (Vitest)                                 |
| `npm run test:e2e`                | Pruebas en el navegador (Playwright), escritorio y celular |

CI (`.github/workflows/ci.yml`) ejecuta lint, formato, tipos, pruebas y build en cada PR y en `main`, y en otro trabajo las pruebas en el navegador.

### Pruebas en el navegador

`tests/e2e/` abre el sitio compilado como en GitHub Pages en Chromium, en tamaño escritorio y celular, y recorre lo que no puede fallar en producción:

- todas las páginas cargan sin errores de JavaScript ni desborde lateral, y no hay enlaces internos rotos;
- el panel no se indexa y no está en el sitemap;
- el menú del celular;
- el pedido: precio por mayor desde 6 unidades, registro con número y apertura de WhatsApp, WhatsApp igual si el registro falla, y nada se envía si faltan datos;
- el Libro de Reclamaciones: campos obligatorios, hoja registrada, sin conexión y el campo del apoderado;
- el panel: contraseña incorrecta, cuenta sin permiso y cambio de estado por el administrador.

Supabase y WhatsApp se simulan en cada prueba (`tests/e2e/fixtures.ts`): las pruebas nunca crean pedidos ni hojas reales. La primera vez instala el navegador con `npx playwright install chromium`. Las reglas de acceso de la base de datos se comprueban aparte, contra Supabase (ver _Panel de pedidos_).

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
| `/panel/`                     | Panel privado de pedidos (con contraseña, sin indexar)                         |
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
- Para ver los pedidos: el [panel de pedidos](#panel-de-pedidos) o Supabase → Table Editor → `pedidos`. Cambia la columna `estado` (`nuevo`, `confirmado`, `pagado`, `enviado`, `entregado`, `cancelado`) y usa `notas_internas` para el seguimiento.
- Aviso por correo de cada pedido: se activa solo con los mismos secretos de Brevo del libro (`BREVO_API_KEY`, `MAIL_FROM`); llega al correo de `libro_proveedor` o al del secreto `PEDIDOS_CORREO`.

### Sigue tu pedido

`/seguimiento/` deja al cliente consultar su pedido con el número (P-000123) y el celular con el que lo hizo. Muestra el avance (Recibido, Confirmado, Pagado, Enviado o "Listo para recoger" si es recojo, Entregado), la fecha, el producto, la entrega y el total estimado. Al terminar un pedido, el formulario enlaza a esta página con el número ya escrito (`/seguimiento/?pedido=P-000123`). También está en el pie de página.

- La consulta es la función `seguir_pedido` de la base (`supabase/migrations/20261006050000_seguimiento_pedido.sql`), llamada con la clave publicable. Solo responde si coinciden número y celular (acepta el celular con o sin +51, espacios o guiones).
- Frena a quien intente adivinar: tras 10 consultas fallidas de un mismo número, o 300 en total, en una hora, responde "muchos intentos" por un rato.
- Lógica y textos para el cliente en `src/lib/tracking.ts`; página en `src/pages/seguimiento.astro`.

### Panel de pedidos

`/panel/` es una página privada (no aparece en el menú, el sitemap ni Google) para ver los pedidos, filtrarlos por estado, cambiar el estado, anotar notas internas y escribir al cliente por WhatsApp.

- Se entra con correo y contraseña de **Supabase Auth**. Solo entran los correos que estén en la tabla `administradores`; el resto ve "Esta cuenta no tiene permiso".
- Para dar acceso: en Supabase → Authentication → Users → _Add user_ crea el usuario (correo y contraseña) y en SQL Editor ejecuta `insert into administradores (correo) values ('correo@ejemplo.com');` (en minúsculas). Para quitarlo, borra la fila.
- **Avisar al cliente**: cada pedido tiene un botón que abre WhatsApp con un mensaje listo para el cliente según el estado guardado (las mismas frases de "Sigue tu pedido") y el enlace de seguimiento con su número. Al guardar un cambio de estado, el aviso de "Guardado" también trae ese enlace. Nada se envía solo: Hluot revisa el mensaje y lo manda desde su WhatsApp. Lógica en `customerNotice` de `src/lib/panel.ts`.
- Desde el panel solo se pueden cambiar `estado` y `notas_internas`; no se pueden crear ni borrar pedidos. Las reglas están en la base (`supabase/migrations/20261006030000_panel_pedidos.sql`), no en la página.
- La clave publicable de `site.panel` es pública por diseño; nunca pongas aquí la clave `service_role` ni otra secreta.

### Resumen de ventas

Arriba del panel: soles y potes vendidos esta semana (desde el lunes), este mes y desde el inicio; una tabla de los últimos 6 meses y las 5 ciudades que más compran. Cuenta los pedidos confirmados, pagados, enviados o entregados (los mismos que descuentan stock) y usa el total estimado del pedido, sin envío. Se calcula en el navegador con los pedidos cargados (hasta 500); la lógica está en `summarizeSales` de `src/lib/panel.ts`, con pruebas.

### Descargar pedidos en Excel

El botón **Descargar Excel** del panel baja un archivo `.xlsx` con los pedidos que se ven en ese momento: todos, o solo los del estado filtrado (por ejemplo `pedidos-quimiver-pagado-2026-10-06.xlsx`). Trae una fila por pedido con fecha y hora de Lima, estado, cliente, teléfono, ciudad, potes, precios, entrega, observaciones y notas internas; los montos van como números para poder sumarlos. El archivo se arma en el navegador sin librerías (`src/lib/xlsx.ts`) y abre en Excel, Google Sheets y LibreOffice.

### Stock

- Tabla `inventario` (hoy un producto, `quimiver-50g`, con 100 potes al empezar) y registro de cada cambio en `movimientos_inventario`. Migración `supabase/migrations/20261006040000_inventario.sql`.
- Regla del negocio: el pote se descuenta cuando el pedido pasa a **Confirmado** (o a Pagado, Enviado o Entregado sin haberse descontado) y vuelve si se **cancela** o regresa a Nuevo. Nunca se descuenta dos veces.
- El descuento es atómico en la base: si no alcanza el stock, el cambio de estado se rechaza y el panel avisa "No hay stock suficiente".
- En el panel se ve cuántos potes quedan (aviso desde 10), se registran potes nuevos o correcciones (número negativo) con su motivo, y se ven los últimos movimientos.
- La web pregunta al servidor si hay stock (solo sí o no, nunca la cantidad). Si no hay, el formulario muestra "agotado" pero deja enviar el pedido como reserva.

## Logo

Sello elegido por Hluot el 2026-10-06 (propuesta A): Q en círculo verde bosque con aro dorado y hoja de congona.

- Componente: `src/components/LogoMark.astro` (`tone="claro"` sobre marfil, `tone="oscuro"` sobre verde). La Q va como trazo, así se ve igual aunque la fuente no cargue.
- Archivos: `public/favicon.svg`, `public/apple-touch-icon.png` (180 px, ícono al guardar la web en el celular), `public/images/quimiver-logo.png` (512 px, el que lee Google) y `public/images/quimiver-compartir.jpg` (1200 × 630, la imagen que sale al compartir el enlace).

## Libro de Reclamaciones virtual

Cumple el D.S. 011-2011-PCM y sus modificatorias: cada hoja recibe un número correlativo (`LR-000001`), fecha y hora, se guarda al menos 2 años y se envía por correo al consumidor y al negocio. El plazo de respuesta es de 15 días hábiles.

- Formulario: `src/pages/libro-de-reclamaciones.astro` y `src/scripts/complaints-form.ts`.
- Reglas de la hoja (compartidas por el sitio, el servidor y las pruebas): `supabase/functions/libro-reclamaciones/complaint.ts`.
- Servidor: Edge Function `libro-reclamaciones` en el proyecto Supabase `quimiver` (São Paulo). Tablas en `supabase/migrations/`.
- El [monitoreo](#monitoreo) consulta el servidor cada 6 horas, y así el proyecto gratuito no se pausa.

### Cómo activarlo

1. **Datos del proveedor**, en dos lugares:
   - `site.legal` de `src/config/site.ts` (razón social, RUC, domicilio). Con eso aparecen la página, el enlace y el aviso en el pie.
   - En Supabase → Table Editor → `libro_proveedor`, la misma razón social, RUC y domicilio. Sin ellos el servidor responde "no habilitado".
2. **Correo** (opcional pero recomendado, la norma pide enviar la copia): crea una cuenta en Brevo, verifica el remitente y en Supabase → Edge Functions → Secrets agrega `BREVO_API_KEY` y `MAIL_FROM`. Nunca pongas estas claves en el código. Sin ellas la hoja se guarda y el cliente puede imprimirla, pero no sale el correo.
3. Si el sitio cambia de dominio, agrega la dirección nueva en el secreto `ALLOWED_ORIGINS` (lista separada por comas) y en `sitio_web` de `libro_proveedor`.

### Cómo responder

En Supabase → Table Editor → `reclamos` aparecen las hojas. Responde al correo del cliente dentro de 15 días hábiles y anota la respuesta en `acciones_proveedor` y la fecha en `respondido_en`.

## Monitoreo

`.github/workflows/monitoreo.yml` corre cada 6 horas `scripts/monitoreo.mjs`, que revisa:

- la página principal (con su formulario de pedido) y la del Libro de Reclamaciones;
- el servidor de pedidos y el del Libro (que siga habilitado).

Cada revisión se reintenta 3 veces antes de contar como falla. Si algo falla, se abre un aviso en **Issues** con la etiqueta `monitoreo` y GitHub lo envía por correo al dueño del repositorio. Si sigue fallando, el mismo aviso recibe un comentario, y cuando todo vuelve a responder se cierra solo con "Se recuperó".

- Probar que el aviso llega: Actions → Monitoreo → _Run workflow_ → marcar "Simular una falla". Se abre un aviso de prueba; al correrlo de nuevo sin marcar, se cierra.
- GitHub desactiva los flujos programados de un repositorio sin cambios durante 60 días; si pasa, se reactiva en Actions → Monitoreo → _Enable workflow_.
- Consultar los servidores también evita que el proyecto gratuito de Supabase se pause.

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
