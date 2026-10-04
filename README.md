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

## Variables de entorno

Copia `.env.example` a `.env` si necesitas definirlas.

| Variable   | Uso                                                                   |
| ---------- | --------------------------------------------------------------------- |
| `SITE_URL` | Opcional. URL pública sin barra final; activa `canonical` y `og:url`. |

## Dónde se editan los datos

| Qué                                                                         | Archivo                              |
| --------------------------------------------------------------------------- | ------------------------------------ |
| Producto: textos, presentaciones, precios, imágenes, FAQ, testimonios       | `src/content/products/quimiver.json` |
| Teléfono, WhatsApp, correo, redes, envíos, métodos de pago, mínimo para precio por mayor | `src/config/site.ts`                 |
| Colores y medidas                                                           | `src/styles/_tokens.scss`            |

El archivo de producto se valida al compilar con el esquema de `src/content.config.ts`: si falta un campo o un precio no es válido, el build falla.

### Contenido pendiente de verificación

Las afirmaciones que necesitan respaldo del negocio (propiedades de salud, certificaciones, composición y testimonios) tienen `"verified": false` en el JSON. Mientras sea así, el sitio no las publica y muestra **DATO PENDIENTE DE DEFINICIÓN** en su lugar.

Para publicar una afirmación, confirma que existe respaldo (registro sanitario, certificado, autorización del cliente para su testimonio, etc.) y cambia su valor a `"verified": true`.

Las redes sociales en `src/config/site.ts` tienen `url: null` hasta que se definan las cuentas oficiales.

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
tests/               Pruebas unitarias
docs/                Documentación técnica
```

## Convenciones

- Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Reglas del proyecto: QUIMIVER Master Skill (no inventar datos de producto, analizar antes de cambiar, etc.).
