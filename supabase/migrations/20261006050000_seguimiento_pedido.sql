-- Seguimiento público de pedidos: el cliente consulta el estado con su número de pedido
-- (P-000123) y el celular con el que pidió. Solo devuelve datos del pedido que coincide con
-- ambos y nunca nombres, notas internas ni observaciones.
-- Contra intentos de adivinar: se anotan las consultas fallidas; tras 10 fallos de un mismo
-- número en una hora, o 300 fallos en total en una hora, la consulta se rechaza por un rato.

create table public.consultas_pedido_fallidas (
  id bigint generated always as identity primary key,
  codigo text not null,
  creado_en timestamptz not null default now()
);

create index consultas_pedido_fallidas_idx on public.consultas_pedido_fallidas (creado_en desc, codigo);

alter table public.consultas_pedido_fallidas enable row level security;
revoke all on public.consultas_pedido_fallidas from anon, authenticated;

create or replace function public.seguir_pedido(p_codigo text, p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_pedido public.pedidos%rowtype;
  v_tel_pedido text;
begin
  if v_codigo ~ '^\d{1,6}$' then
    v_codigo := 'P-' || lpad(v_codigo, 6, '0');
  elsif v_codigo ~ '^P-?\d{1,6}$' then
    v_codigo := 'P-' || lpad(regexp_replace(v_codigo, '\D', '', 'g'), 6, '0');
  else
    return jsonb_build_object('ok', false, 'error', 'datos');
  end if;
  if char_length(v_tel) not between 6 and 15 then
    return jsonb_build_object('ok', false, 'error', 'datos');
  end if;

  -- Freno a los intentos repetidos. La tabla crece poco: como mucho 300 filas por hora.
  if (select count(*) from public.consultas_pedido_fallidas
      where creado_en > now() - interval '1 hour' and codigo = v_codigo) >= 10
     or (select count(*) from public.consultas_pedido_fallidas
      where creado_en > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;

  select * into v_pedido from public.pedidos where codigo = v_codigo;
  v_tel_pedido := regexp_replace(coalesce(v_pedido.telefono, ''), '\D', '', 'g');

  -- Coincide si los dígitos son iguales o si terminan en los mismos 9 (con o sin +51).
  if v_pedido.id is null or not (
    v_tel_pedido = v_tel
    or (char_length(v_tel_pedido) >= 9 and char_length(v_tel) >= 9 and right(v_tel_pedido, 9) = right(v_tel, 9))
  ) then
    insert into public.consultas_pedido_fallidas (codigo) values (v_codigo);
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_pedido.codigo,
    'estado', v_pedido.estado,
    'creado_en', v_pedido.creado_en,
    'presentacion', v_pedido.presentacion,
    'cantidad', v_pedido.cantidad,
    'entrega', v_pedido.entrega,
    'total_estimado', v_pedido.total_estimado
  );
end;
$$;

revoke all on function public.seguir_pedido(text, text) from public;
grant execute on function public.seguir_pedido(text, text) to anon, authenticated;

comment on function public.seguir_pedido(text, text) is
  'Seguimiento público: estado de un pedido por número y celular. Limita los intentos fallidos.';
