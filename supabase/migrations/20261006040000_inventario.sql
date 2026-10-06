-- Control de stock. Un solo producto hoy (pote de 50 g), pero la tabla admite más.
-- Regla (Hluot, 6/10/2026): stock inicial 100 potes. El pote se descuenta cuando el pedido
-- pasa a un estado de venta (confirmado, pagado, enviado o entregado) y vuelve si se cancela.
-- Todo cambio queda en movimientos_inventario. El descuento es atómico: si no alcanza el
-- stock, el cambio de estado se rechaza y nada se guarda.

create table public.inventario (
  producto text primary key,
  stock integer not null check (stock >= 0),
  actualizado_en timestamptz not null default now()
);

create table public.movimientos_inventario (
  id bigint generated always as identity primary key,
  producto text not null references public.inventario (producto),
  cantidad integer not null check (cantidad <> 0),
  stock_resultante integer not null,
  motivo text not null check (char_length(motivo) between 2 and 200),
  pedido_id bigint references public.pedidos (id),
  creado_por text,
  creado_en timestamptz not null default now()
);

create index movimientos_inventario_producto_idx
  on public.movimientos_inventario (producto, creado_en desc);
create index movimientos_inventario_pedido_idx on public.movimientos_inventario (pedido_id);

alter table public.inventario enable row level security;
alter table public.movimientos_inventario enable row level security;
revoke all on public.inventario, public.movimientos_inventario from anon, authenticated;

alter table public.pedidos add column stock_descontado boolean not null default false;

insert into public.inventario (producto, stock) values ('quimiver-50g', 100);
insert into public.movimientos_inventario (producto, cantidad, stock_resultante, motivo)
values ('quimiver-50g', 100, 100, 'Stock inicial');

-- Estados en los que el pedido ya cuenta como venta.
create or replace function public.estado_descuenta_stock(estado text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select estado in ('confirmado', 'pagado', 'enviado', 'entregado');
$$;

-- Suma o resta stock dejando el movimiento. Falla si el stock quedaría negativo.
create or replace function public.mover_stock(
  p_producto text,
  p_cantidad integer,
  p_motivo text,
  p_pedido_id bigint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo integer;
begin
  update public.inventario
     set stock = stock + p_cantidad, actualizado_en = now()
   where producto = p_producto and stock + p_cantidad >= 0
  returning stock into nuevo;

  if nuevo is null then
    if not exists (select 1 from public.inventario where producto = p_producto) then
      raise exception 'Producto sin inventario: %', p_producto using errcode = 'P0002';
    end if;
    raise exception 'Stock insuficiente' using errcode = 'P0001',
      hint = 'Agrega stock en el panel o revisa la cantidad del pedido.';
  end if;

  insert into public.movimientos_inventario
    (producto, cantidad, stock_resultante, motivo, pedido_id, creado_por)
  values
    (p_producto, p_cantidad, nuevo, p_motivo, p_pedido_id, (select auth.jwt() ->> 'email'));
  return nuevo;
end;
$$;

revoke all on function public.mover_stock(text, integer, text, bigint) from public, anon, authenticated;

-- Al cambiar el estado de un pedido, descuenta o devuelve el stock.
create or replace function public.pedidos_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- En un trigger BEFORE las columnas generadas (codigo) aún no tienen valor en NEW.
  if public.estado_descuenta_stock(new.estado) and not old.stock_descontado then
    perform public.mover_stock('quimiver-50g', -new.cantidad,
      'Pedido ' || old.codigo || ' ' || new.estado, new.id);
    new.stock_descontado := true;
  elsif new.estado = 'cancelado' and old.stock_descontado then
    perform public.mover_stock('quimiver-50g', new.cantidad,
      'Pedido ' || old.codigo || ' cancelado', new.id);
    new.stock_descontado := false;
  elsif new.estado = 'nuevo' and old.stock_descontado then
    perform public.mover_stock('quimiver-50g', new.cantidad,
      'Pedido ' || old.codigo || ' volvió a nuevo', new.id);
    new.stock_descontado := false;
  end if;
  return new;
end;
$$;

revoke all on function public.pedidos_stock() from public, anon, authenticated;

create trigger pedidos_stock
  before update of estado on public.pedidos
  for each row
  when (old.estado is distinct from new.estado)
  execute function public.pedidos_stock();

-- Panel: ver el stock y los últimos movimientos.
create or replace function public.ver_stock()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_administrador() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'stock', (select stock from public.inventario where producto = 'quimiver-50g'),
    'movimientos', coalesce((
      select jsonb_agg(m order by m.creado_en desc)
      from (
        select cantidad, stock_resultante, motivo, creado_en
        from public.movimientos_inventario
        where producto = 'quimiver-50g'
        order by creado_en desc
        limit 20
      ) m
    ), '[]'::jsonb)
  );
end;
$$;

-- Panel: sumar potes (producción nueva) o corregir el conteo.
create or replace function public.ajustar_stock(p_cantidad integer, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_administrador() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_cantidad = 0 or abs(p_cantidad) > 100000 then
    raise exception 'Cantidad no válida' using errcode = '22023';
  end if;
  return public.mover_stock('quimiver-50g', p_cantidad, trim(p_motivo));
end;
$$;

revoke all on function public.ver_stock(), public.ajustar_stock(integer, text) from public, anon;
grant execute on function public.ver_stock(), public.ajustar_stock(integer, text) to authenticated;
