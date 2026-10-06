-- Registro de pedidos del formulario de compra. El pedido sigue confirmándose por WhatsApp;
-- esta tabla guarda una copia numerada para que ninguno se pierda.
-- Solo la Edge Function (clave de servicio) escribe; el público no tiene acceso directo.

create table public.pedidos (
  id bigint generated always as identity primary key,
  codigo text generated always as ('P-' || lpad(id::text, 6, '0')) stored unique,
  creado_en timestamptz not null default now(),
  cliente_nombre text not null check (char_length(cliente_nombre) between 2 and 120),
  telefono text not null check (char_length(telefono) between 6 and 16),
  ciudad text not null check (char_length(ciudad) between 2 and 120),
  presentacion text not null check (char_length(presentacion) between 1 and 80),
  cantidad integer not null check (cantidad between 1 and 10000),
  precio_unitario numeric(10, 2) not null check (precio_unitario > 0),
  tipo_precio text not null check (tipo_precio in ('menudeo', 'por mayor')),
  entrega text not null check (char_length(entrega) between 1 and 120),
  total_estimado numeric(12, 2) not null check (total_estimado >= 0),
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  -- Seguimiento interno (se edita desde el panel de Supabase).
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'confirmado', 'pagado', 'enviado', 'entregado', 'cancelado')),
  notas_internas text
);

comment on table public.pedidos is
  'Pedidos del formulario de QUIMIVER. Montos estimados; el precio final y el envío se confirman por WhatsApp.';

create index pedidos_telefono_creado_idx on public.pedidos (telefono, creado_en desc);
create index pedidos_estado_idx on public.pedidos (estado, creado_en desc);

alter table public.pedidos enable row level security;
-- Sin políticas: anon y authenticated no pueden leer ni escribir. Solo service_role.
revoke all on public.pedidos from anon, authenticated;
