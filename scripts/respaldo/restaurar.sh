#!/usr/bin/env bash
# Descifra un respaldo y lo restaura en una base PostgreSQL vacía.
# En el respaldo semanal se usa contra una base temporal para probar que el respaldo sirve;
# también sirve para recuperar los datos en un proyecto nuevo de Supabase (ver docs/respaldos.md).
#
# Uso: DESTINO_DB_URL=... RESPALDO_CLAVE=... scripts/respaldo/restaurar.sh <archivo.tar.gpg>
#
# RESTAURAR_MODO elige cómo:
#   completo (por defecto): borra el esquema public del destino y lo recrea desde el respaldo,
#     con tablas, funciones y datos. Solo para una base de prueba; crea antes los roles y las
#     funciones de Supabase que el respaldo necesita.
#   datos: vacía las tablas del destino y copia las filas del respaldo. Para un proyecto nuevo
#     de Supabase donde ya se aplicaron las migraciones de supabase/migrations/ (así quedan
#     también los permisos y las reglas RLS). Nunca contra la base en uso.
set -euo pipefail

: "${DESTINO_DB_URL:?Falta DESTINO_DB_URL (base donde restaurar)}"
: "${RESPALDO_CLAVE:?Falta RESPALDO_CLAVE (la misma clave con la que se cifró)}"
archivo="${1:?Indica el archivo .tar.gpg}"

trabajo="$(mktemp -d)"
trap 'rm -rf "$trabajo"' EXIT

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$trabajo/quimiver.tar" "$archivo" 3<<<"$RESPALDO_CLAVE"
tar -C "$trabajo" -xf "$trabajo/quimiver.tar"

modo="${RESTAURAR_MODO:-completo}"
psql_destino=(psql "$DESTINO_DB_URL" --no-psqlrc --quiet --set=ON_ERROR_STOP=1)

if [[ "$modo" == "completo" ]]; then
  "${psql_destino[@]}" <<'SQL'
set client_min_messages = warning;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable
  as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
create or replace function auth.uid() returns uuid language sql stable
  as $f$ select nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
drop schema public cascade;
SQL
  pg_restore --dbname="$DESTINO_DB_URL" --no-owner --no-privileges --exit-on-error \
    "$trabajo/quimiver.dump"
elif [[ "$modo" == "datos" ]]; then
  # Las migraciones dejan filas iniciales (stock, datos del proveedor); se vacían para que
  # queden exactamente las del respaldo.
  "${psql_destino[@]}" <<'SQL'
set client_min_messages = warning;
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('truncate table public.%I restart identity cascade', t);
  end loop;
end $$;
SQL
  # Sin revisar llaves foráneas ni disparadores mientras se copia (el orden de las tablas no
  # importa así); Supabase lo permite al usuario postgres.
  PGOPTIONS='-c session_replication_role=replica' \
    pg_restore --dbname="$DESTINO_DB_URL" --no-owner --no-privileges --exit-on-error \
    --data-only "$trabajo/quimiver.dump"
else
  echo "RESTAURAR_MODO debe ser completo o datos" >&2
  exit 2
fi

# Comprueba que cada tabla tenga al menos las filas que tenía al crear el respaldo.
# Solo se nombra la tabla que falla, sin cantidades (los registros de GitHub son públicos).
fallas=0
tablas=0
while read -r tabla esperado; do
  [[ -z "$tabla" ]] && continue
  tablas=$((tablas + 1))
  real="$(psql "$DESTINO_DB_URL" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    -c "select count(*) from public.\"$tabla\"")"
  if ((real < esperado)); then
    echo "FALLA: a la tabla $tabla le faltan filas después de restaurar" >&2
    fallas=1
  fi
done <"$trabajo/conteos.txt"

if ((fallas)); then exit 1; fi
echo "Restauración comprobada: $tablas tablas con todas sus filas."
