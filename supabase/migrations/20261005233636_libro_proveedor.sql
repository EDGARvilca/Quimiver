-- Datos del proveedor que figuran en cada hoja. Una sola fila.
-- Mientras razón social, RUC o domicilio estén vacíos, el libro no acepta hojas.
create table public.libro_proveedor (
  id boolean primary key default true check (id),
  nombre_comercial text not null default 'QUIMIVER',
  razon_social text,
  ruc text check (ruc is null or ruc ~ '^(10|15|17|20)\d{9}$'),
  domicilio text,
  correo text not null default 'ventas@quimicaverdeandina.pe',
  sitio_web text not null default 'https://edgarvilca.github.io/Quimiver/',
  actualizado_en timestamptz not null default now()
);

insert into public.libro_proveedor (id) values (true);

alter table public.libro_proveedor enable row level security;
revoke all on public.libro_proveedor from anon, authenticated;
