-- El sitio pasa a celgimed.cov.com.pe: la hoja de reclamación muestra la nueva dirección.
alter table public.libro_proveedor
  alter column sitio_web set default 'https://celgimed.cov.com.pe/';
update public.libro_proveedor
set sitio_web = 'https://celgimed.cov.com.pe/'
where sitio_web = 'https://quimiver.cov.com.pe/';
