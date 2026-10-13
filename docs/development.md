# Desarrollo

## Requisitos

- Node.js 22 (`.nvmrc`) y npm.
- Para las pruebas en navegador: Chromium de Playwright (`npx playwright install chromium` la primera vez).
- Opcional: PostgreSQL 17 local para probar migraciones y respaldos.

## Primeros pasos

```bash
npm ci
npm run dev          # http://localhost:4321
```

Para ver la web como en GitHub Pages (con la subcarpeta):

```bash
BASE_PATH=/Quimiver SITE_URL=https://edgarvilca.github.io npm run build
BASE_PATH=/Quimiver SITE_URL=https://edgarvilca.github.io npx astro preview
```

En desarrollo la web usa los datos de `src/content/products/quimiver.json`. Los formularios llaman a las funciones reales de Supabase (que aceptan `localhost:4321`); para no crear pedidos de prueba, usa las pruebas en navegador, que simulan Supabase.

## Organización del código

```
src/
├── components/         Secciones (Astro). Sin JavaScript salvo los formularios.
├── config/site.ts      Negocio: contacto, envíos, pagos, datos legales, Supabase.
├── config/pages.ts     Rutas de las páginas.
├── content/products/   Datos del producto (JSON); esquema en src/content.config.ts.
├── layouts/            BaseLayout (SEO, CSP, "Saltar al contenido") y PageLayout.
├── lib/                Lógica pura, sin DOM y con pruebas: pedido, panel, seguimiento,
│                       Excel, rutas, animaciones.
├── pages/              Una página por archivo; panel.astro es el panel privado.
├── scripts/            Código de navegador que usa lib/: formularios, panel, seguimiento.
└── styles/global.scss  Estilos y tokens (colores, radios, sombras).
supabase/
├── migrations/         Esquema de la base (ver docs/database.md).
└── functions/          Edge Functions; la validación (pedido.ts, complaint.ts) se prueba
                        con Vitest desde tests/.
scripts/                Monitoreo y respaldos (se ejecutan en GitHub Actions).
tests/                  Pruebas unitarias (Vitest).
tests/e2e/              Pruebas en navegador (Playwright), con Supabase y WhatsApp simulados.
```

Regla de capas: `lib/` no toca el DOM ni la red; `scripts/` arma la pantalla y llama a la red usando `lib/`; los componentes Astro solo pintan datos. Así casi toda la lógica se prueba sin navegador.

## Comandos

| Comando                           | Qué hace                                            |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo.                             |
| `npm run build`                   | Compila a `dist/`.                                  |
| `npm run check`                   | Tipos de TypeScript y Astro.                        |
| `npm run lint`                    | ESLint.                                             |
| `npm run format` / `format:check` | Prettier.                                           |
| `npm test`                        | Pruebas unitarias.                                  |
| `npm run test:e2e`                | Pruebas en navegador (compila y sirve la web sola). |

Antes de abrir un PR deben pasar todos; CI corre los mismos.

## Pruebas

- **Unitarias** (`tests/*.test.ts`): toda función de `src/lib/` y la validación de las Edge Functions.
- **En navegador** (`tests/e2e/*.spec.ts`): flujos completos en escritorio y en un Pixel 7: pedido, libro, seguimiento, panel, menú, todas las páginas sin errores ni desborde y accesibilidad (axe, WCAG 2.1 A y AA). `fixtures.ts` corta toda llamada real a Supabase; cada prueba simula lo que necesita con `context.route`. La prueba falla si hay errores de JavaScript en la página.
- **Base de datos**: las migraciones se prueban en un PostgreSQL local con los roles `anon` y `authenticated` y un `auth.jwt()` simulado, incluidos los casos que deben ser rechazados.

## Convenciones

- Idioma: español en la interfaz, comentarios, commits y documentación; nombres de código en inglés salvo los que vienen de la base (`cliente_nombre`, `estado`).
- Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Una rama y un PR por cambio. Nada llega a `main` sin el "publica" de Hluot.
- No inventar datos del producto, científicos, legales ni de precios. Lo que no está confirmado lleva `"verified": false` y no se muestra.
- Sin librerías nuevas en la web publicada salvo que hagan falta de verdad (el Excel, por ejemplo, se arma sin librerías).
- Textos dinámicos siempre con `textContent`, nunca `innerHTML` (ver `docs/seguridad.md`).
- Accesibilidad: etiquetas en todos los campos, foco visible, `aria-invalid` con el mensaje de error, contraste AA y respeto a "reducir movimiento".
