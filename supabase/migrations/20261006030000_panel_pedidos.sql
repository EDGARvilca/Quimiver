-- Panel de pedidos: las personas autorizadas (tabla administradores) pueden ver los pedidos
-- y cambiar su estado y notas internas iniciando sesión con Supabase Auth.
-- El público sigue sin acceso: solo usuarios con sesión cuyo correo esté en la lista.

create table public.administradores (
  correo text primary key check (correo = lower(correo)),
  agregado_en timestamptz not null default now()
);

alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores
    where correo = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

revoke all on function public.es_administrador() from public, anon;
grant execute on function public.es_administrador() to authenticated;

-- Solo lectura y cambio de estado y notas; nunca borrar ni crear desde el panel.
grant select on public.pedidos to authenticated;
grant update (estado, notas_internas) on public.pedidos to authenticated;

create policy "Administradores ven los pedidos"
  on public.pedidos for select to authenticated
  using ((select public.es_administrador()));

create policy "Administradores actualizan los pedidos"
  on public.pedidos for update to authenticated
  using ((select public.es_administrador()))
  with check ((select public.es_administrador()));
