# Respaldos de la base de datos

Cada domingo a las 03:17 (hora de Lima) el flujo **Respaldo semanal**
(`.github/workflows/respaldo.yml`) hace esto:

1. Copia el esquema `public` de Supabase: pedidos, hojas del Libro de Reclamaciones, stock y sus
   movimientos, administradores y datos del proveedor. No copia las cuentas de Supabase Auth
   (correo y contraseña del panel); esas se vuelven a crear a mano, ver más abajo.
2. Cifra la copia con AES-256 usando la clave `RESPALDO_CLAVE`. El repositorio es público, por
   eso el archivo nunca se guarda sin cifrar y los registros no muestran cuántas filas hay.
3. **Prueba la restauración**: descifra la copia, la carga en una base PostgreSQL 17 temporal y
   comprueba que cada tabla tenga todas sus filas. Un respaldo que no pasa esta prueba no se
   guarda.
4. Guarda el archivo `quimiver-AAAA-MM-DD.tar.gpg` en GitHub durante 90 días (unas 13 copias).

Si algo falla, abre un aviso (issue) con la etiqueta `respaldo`, que llega por correo; cuando
vuelve a funcionar, lo cierra.

Scripts: `scripts/respaldo/crear.sh` y `scripts/respaldo/restaurar.sh`.

## Activarlo (una sola vez, lo hace el dueño)

Los dos datos son secretos: se ponen directamente en GitHub y nunca se escriben en el chat, en
el código ni en un correo.

1. **Cadena de conexión.** En Supabase, abre el proyecto `quimiver` y pulsa **Connect** (arriba).
   En **Session pooler** copia la dirección que empieza con `postgresql://postgres.buuelzmvfidigimbrplm:`
   y cambia `[YOUR-PASSWORD]` por la contraseña de la base de datos. Si no la recuerdas:
   **Project Settings → Database → Reset database password** (cambiarla no afecta a la web).
   Se usa el _Session pooler_ porque GitHub no puede conectarse a la dirección directa.
2. En GitHub, en el repositorio `Quimiver`: **Settings → Secrets and variables → Actions →
   New repository secret**. Nombre `SUPABASE_DB_URL`, valor: la dirección del paso 1.
3. Inventa una clave larga (por ejemplo cinco palabras al azar) y **guárdala en un lugar seguro
   fuera de GitHub** (gestor de contraseñas o papel guardado). Sin ella los respaldos no se
   pueden abrir. Crea otro secreto con el nombre `RESPALDO_CLAVE` y esa clave.
4. En **Actions → Respaldo semanal → Run workflow** se puede lanzar el primero sin esperar al
   domingo.

## Descargar un respaldo

**Actions → Respaldo semanal**, abre la ejecución de la fecha que quieras y descarga el archivo
de la sección **Artifacts** (hay que haber iniciado sesión en GitHub). Viene dentro de un `.zip`
que contiene `quimiver-AAAA-MM-DD.tar.gpg`.

## Restaurar

Hace falta un equipo con Linux o macOS, `gpg` y las herramientas de PostgreSQL 17
(`pg_restore`, `psql`).

**En un proyecto nuevo de Supabase** (por ejemplo si el actual se borró):

1. Crea el proyecto y aplica, en orden, las migraciones de `supabase/migrations/` (SQL Editor o
   `supabase db push`). Así quedan las tablas, los permisos y las reglas de acceso.
2. Restaura solo los datos (vacía antes las tablas del proyecto nuevo):

   ```sh
   DESTINO_DB_URL='postgresql://postgres.<nuevo-proyecto>:<contraseña>@<host>:5432/postgres' \
   RESPALDO_CLAVE='<la clave>' RESTAURAR_MODO=datos \
   scripts/respaldo/restaurar.sh quimiver-AAAA-MM-DD.tar.gpg
   ```

3. Vuelve a desplegar las funciones `pedidos` y `libro-reclamaciones`, crea el usuario del panel
   en Authentication y agrega su correo a la tabla `administradores` (ver el README).
4. Cambia la dirección y la clave publicable de Supabase en `src/config/site.ts` y publica.

**Nunca** uses `RESTAURAR_MODO=datos` contra la base en uso: vacía las tablas antes de copiar.

**Solo para revisar un respaldo**, en una base PostgreSQL vacía cualquiera, el modo por defecto
(`completo`) recrea todo: `DESTINO_DB_URL=... RESPALDO_CLAVE=... scripts/respaldo/restaurar.sh archivo.tar.gpg`.

## Probado

Los dos modos se probaron en local (PostgreSQL 16) con una base creada desde las migraciones:
restauración completa, restauración de datos en una base con las migraciones aplicadas (el
siguiente pedido sigue la numeración, P-000003 después de P-000002) y rechazo con una clave
equivocada. La prueba con la base real corre en GitHub en cada respaldo.
