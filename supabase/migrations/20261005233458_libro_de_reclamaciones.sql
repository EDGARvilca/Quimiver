-- Libro de Reclamaciones virtual (D.S. 011-2011-PCM y modificatorias).
-- Solo la Edge Function (clave de servicio) escribe y lee; el público no tiene acceso directo.

create table public.reclamos (
  id bigint generated always as identity primary key,
  codigo text generated always as ('LR-' || lpad(id::text, 6, '0')) stored unique,
  creado_en timestamptz not null default now(),
  tipo text not null check (tipo in ('reclamo', 'queja')),
  consumidor_nombre text not null check (char_length(consumidor_nombre) between 2 and 120),
  documento_tipo text not null check (documento_tipo in ('DNI', 'CE', 'Pasaporte', 'RUC')),
  documento_numero text not null check (char_length(documento_numero) between 5 and 20),
  domicilio text not null check (char_length(domicilio) between 5 and 200),
  telefono text not null check (char_length(telefono) between 6 and 20),
  correo text not null check (char_length(correo) between 5 and 120),
  menor_de_edad boolean not null default false,
  apoderado_nombre text check (apoderado_nombre is null or char_length(apoderado_nombre) between 2 and 120),
  bien_tipo text not null check (bien_tipo in ('producto', 'servicio')),
  monto numeric(10, 2) check (monto is null or monto >= 0),
  bien_descripcion text not null check (char_length(bien_descripcion) between 3 and 300),
  numero_pedido text check (numero_pedido is null or char_length(numero_pedido) <= 40),
  detalle text not null check (char_length(detalle) between 10 and 3000),
  pedido text not null check (char_length(pedido) between 5 and 1500),
  -- Respuesta del proveedor (se completa desde el panel; plazo: 15 días hábiles).
  acciones_proveedor text,
  respondido_en timestamptz,
  correo_consumidor_enviado_en timestamptz,
  correo_proveedor_enviado_en timestamptz,
  constraint apoderado_si_menor check (not menor_de_edad or apoderado_nombre is not null)
);

comment on table public.reclamos is
  'Hojas de reclamación del Libro de Reclamaciones virtual de QUIMIVER. Conservar al menos 2 años (art. 12).';

create index reclamos_correo_creado_idx on public.reclamos (correo, creado_en desc);

alter table public.reclamos enable row level security;
-- Sin políticas: anon y authenticated no pueden leer ni escribir. Solo service_role.
revoke all on public.reclamos from anon, authenticated;
