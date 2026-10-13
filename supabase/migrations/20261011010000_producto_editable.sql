-- Datos del producto que se editan desde el panel: presentación, precios, mínimo por mayor
-- y dos textos. La web los lee al compilarse (PRODUCTO_DESDE_BASE=1 en el despliegue) y
-- una revisión programada vuelve a publicarla cuando cambian (.github/workflows/producto.yml).
-- Son datos públicos: cualquiera puede leerlos; solo un administrador puede cambiarlos.
-- Cada cambio queda en producto_web_cambios con el antes, el después y quién lo hizo.

create table public.producto_web (
  producto text primary key references public.inventario (producto),
  presentacion text not null check (char_length(presentacion) between 2 and 60),
  precio numeric(8, 2) not null check (precio > 0 and precio <= 10000),
  precio_mayor numeric(8, 2) not null check (precio_mayor > 0),
  minimo_mayor integer not null check (minimo_mayor between 2 and 1000),
  descripcion_corta text not null check (char_length(descripcion_corta) between 10 and 300),
  descripcion_google text not null check (char_length(descripcion_google) between 50 and 160),
  actualizado_en timestamptz not null default now(),
  actualizado_por text,
  constraint precio_mayor_no_supera_precio check (precio_mayor <= precio)
);

create table public.producto_web_cambios (
  id bigint generated always as identity primary key,
  producto text not null references public.producto_web (producto),
  antes jsonb not null,
  despues jsonb not null,
  creado_por text,
  creado_en timestamptz not null default now()
);

create index producto_web_cambios_producto_idx
  on public.producto_web_cambios (producto, creado_en desc);

alter table public.producto_web enable row level security;
alter table public.producto_web_cambios enable row level security;
revoke all on public.producto_web, public.producto_web_cambios from anon, authenticated;

-- Valores de hoy (los mismos de src/content/products/quimiver.json).
insert into public.producto_web
  (producto, presentacion, precio, precio_mayor, minimo_mayor, descripcion_corta, descripcion_google)
values (
  'quimiver-50g',
  'Frasco de 50 g',
  25,
  20,
  6,
  'QUIMIVER es elaborado por CELGIMED, inspirado en la sabiduría de Huaraz.',
  'QUIMIVER es un producto de CELGIMED elaborado a base de congona de Huaraz. Conoce el producto y realiza tu pedido por WhatsApp.'
);

grant select on public.producto_web to anon, authenticated;
create policy "Todos leen el producto"
  on public.producto_web for select to anon, authenticated
  using (true);

grant update (presentacion, precio, precio_mayor, minimo_mayor, descripcion_corta, descripcion_google)
  on public.producto_web to authenticated;
create policy "Administradores cambian el producto"
  on public.producto_web for update to authenticated
  using ((select public.es_administrador()))
  with check ((select public.es_administrador()));

grant select on public.producto_web_cambios to authenticated;
create policy "Administradores ven los cambios del producto"
  on public.producto_web_cambios for select to authenticated
  using ((select public.es_administrador()));

-- Sella la fecha y el autor, y guarda solo los campos que cambiaron.
create or replace function public.producto_web_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := '{}';
  despues jsonb := '{}';
  campo text;
begin
  new.producto := old.producto;
  new.actualizado_en := now();
  new.actualizado_por := (select auth.jwt() ->> 'email');
  foreach campo in array array[
    'presentacion', 'precio', 'precio_mayor', 'minimo_mayor',
    'descripcion_corta', 'descripcion_google'
  ] loop
    if (to_jsonb(old) -> campo) is distinct from (to_jsonb(new) -> campo) then
      antes := antes || jsonb_build_object(campo, to_jsonb(old) -> campo);
      despues := despues || jsonb_build_object(campo, to_jsonb(new) -> campo);
    end if;
  end loop;
  if despues = '{}' then
    -- Nada cambió: no se mueve la fecha, así la web no se vuelve a publicar.
    new.actualizado_en := old.actualizado_en;
    new.actualizado_por := old.actualizado_por;
    return new;
  end if;
  insert into public.producto_web_cambios (producto, antes, despues, creado_por)
  values (old.producto, antes, despues, new.actualizado_por);
  return new;
end;
$$;

revoke all on function public.producto_web_cambio() from public, anon, authenticated;

create trigger producto_web_cambio
  before update on public.producto_web
  for each row
  execute function public.producto_web_cambio();
