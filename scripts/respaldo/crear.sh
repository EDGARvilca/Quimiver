#!/usr/bin/env bash
# Crea un respaldo cifrado de los datos de QUIMIVER (esquema public de Supabase):
# pedidos, hojas del libro de reclamaciones, stock, administradores, etc.
#
# Uso: SUPABASE_DB_URL=... RESPALDO_CLAVE=... scripts/respaldo/crear.sh <carpeta-de-salida>
# Deja <carpeta>/quimiver-AAAA-MM-DD.tar.gpg. El archivo sin cifrar nunca sale del equipo.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta el secreto SUPABASE_DB_URL (cadena de conexión de Supabase)}"
: "${RESPALDO_CLAVE:?Falta el secreto RESPALDO_CLAVE (clave para cifrar el respaldo)}"

salida="${1:?Indica la carpeta de salida}"
mkdir -p "$salida"
trabajo="$(mktemp -d)"
trap 'rm -rf "$trabajo"' EXIT

fecha="$(TZ=America/Lima date +%F)"

# Filas por tabla antes del respaldo, para comprobar la restauración.
psql "$SUPABASE_DB_URL" --no-psqlrc --quiet --tuples-only --no-align --field-separator=' ' \
  --set=ON_ERROR_STOP=1 >"$trabajo/conteos.txt" <<'SQL'
select format('select %L, count(*) from public.%I', tablename, tablename)
from pg_tables where schemaname = 'public' order by tablename
\gexec
SQL

pg_dump "$SUPABASE_DB_URL" --format=custom --schema=public --no-owner --no-privileges \
  --file="$trabajo/quimiver.dump"

tar -C "$trabajo" -cf "$trabajo/quimiver.tar" quimiver.dump conteos.txt
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$salida/quimiver-$fecha.tar.gpg" \
  "$trabajo/quimiver.tar" 3<<<"$RESPALDO_CLAVE"

# No se imprimen las filas por tabla: los registros de GitHub de un repositorio público los
# puede ver cualquiera.
echo "Respaldo creado: quimiver-$fecha.tar.gpg ($(wc -l <"$trabajo/conteos.txt") tablas)"
