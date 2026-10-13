# Despliegue

## Dónde vive cada parte

| Parte                                            | Dónde                                                | Cómo se publica                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Web (HTML, CSS, JS, imágenes)                    | GitHub Pages: https://edgarvilca.github.io/Quimiver/ | Sola, en cada cambio que llega a `main`.                                                                        |
| Base de datos                                    | Supabase, plan gratuito                              | Migraciones de `supabase/migrations/` aplicadas al publicar el PR que las trae.                                 |
| Edge Functions `pedidos` y `libro-reclamaciones` | Supabase                                             | Se suben con el conector de Supabase (o `supabase functions deploy <nombre>`) al publicar el PR que las cambia. |

No hay servidores propios ni Docker: GitHub Pages sirve la web con HTTPS y Supabase corre la base y las funciones.

## Flujo de un cambio

```mermaid
flowchart LR
  A[Rama feat/...] --> B[Pull request]
  B --> C{CI: lint, formato, tipos,<br/>pruebas, compilación,<br/>pruebas en navegador}
  C -- rojo --> A
  C -- verde --> D[Hluot dice "publica"]
  D --> E[Unir a main]
  E --> F[Publicar en GitHub Pages]
  F --> G[Web publicada]
  E -. si trae migración o función .-> H[Aplicar en Supabase]
```

1. Cada cambio va en su rama (`feat/...`, `fix/...`, `docs/...`) y se abre un PR.
2. `.github/workflows/ci.yml` corre en el PR: `npm run lint`, `npm run format:check`, `npm run check`, `npm test`, `npm run build` y las pruebas en navegador (`npm run test:e2e`, escritorio y celular).
3. Con todo en verde, y solo con el "publica" de Hluot, se une a `main`.
4. `.github/workflows/pages.yml` ("Publicar en GitHub Pages") repite las pruebas unitarias, compila con `SITE_URL` y `BASE_PATH` que entrega GitHub Pages y publica `dist/`.
5. Si el PR trae una migración o cambia una función, se aplica en Supabase en ese momento y se prueba en vivo.

A veces el despliegue de Pages queda en cola y GitHub lo cancela; volver a correrlo desde Actions lo resuelve.

## Variables

| Variable                                                          | Dónde                               | Para qué                                                                  |
| ----------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| `SITE_URL`, `BASE_PATH`                                           | Compilación (las pone Pages)        | Enlaces absolutos, canonical, sitemap y la subcarpeta `/Quimiver`.        |
| `PRODUCTO_DESDE_BASE`                                             | Compilación (PR de producto)        | Con `1`, los precios y textos editables salen de la tabla `producto_web`. |
| `SUPABASE_DB_URL`, `RESPALDO_CLAVE`                               | Secretos de GitHub (PR de respaldo) | Respaldo semanal cifrado. Los pone Hluot.                                 |
| `BREVO_API_KEY`, `MAIL_FROM`, `PEDIDOS_CORREO`, `ALLOWED_ORIGINS` | Secretos de las Edge Functions      | Correos y orígenes permitidos. Los pone Hluot en Supabase.                |

Las claves nunca van en el código ni en el chat. La clave publicable de Supabase sí está en `src/config/site.ts` porque es pública por diseño.

## Tareas programadas (GitHub Actions)

| Flujo                           | Cuándo                       | Qué hace                                                                                                                                                     |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `monitoreo.yml`                 | Cada 6 horas                 | Revisa la web y las dos funciones; abre un aviso (issue "monitoreo") si algo falla y lo cierra al recuperarse. También evita que Supabase pause el proyecto. |
| `respaldo.yml` (PR de respaldo) | Domingos 03:17, hora de Lima | Copia cifrada de la base, prueba de restauración y archivo guardado 90 días.                                                                                 |

GitHub apaga los flujos programados de un repositorio sin actividad durante 60 días; si eso pasa llega un correo y se reactivan desde Actions.

## Configuración de Supabase que no está en el código

- **Auth → URL Configuration → Site URL**: `https://edgarvilca.github.io/Quimiver/panel/` (necesario para "Olvidé mi contraseña").
- **Auth → Sign In / Providers**: se recomienda desactivar el registro abierto de cuentas.
- **Tabla `administradores`**: correos con acceso al panel.

## Volver atrás

- **Web**: revertir el commit en `main` (`git revert`) y publicar; Pages vuelve a la versión anterior en unos minutos.
- **Función**: volver a subir la versión anterior del código de `supabase/functions/`.
- **Base**: escribir una migración nueva que deshaga el cambio. Para pérdida de datos, restaurar desde el respaldo (`docs/respaldos.md`).

## Dominio propio (pendiente)

Cuando exista (por ejemplo `quimiver.pe`): configurarlo en Settings → Pages, cambiar `SITE_URL` y `BASE_PATH` (vacío), agregar el dominio a `ALLOWED_ORIGINS` de las dos funciones y a las URLs de Auth, y actualizar `scripts/monitoreo.mjs`.
