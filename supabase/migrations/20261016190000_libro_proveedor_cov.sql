-- Datos del proveedor que salen en cada hoja del Libro de Reclamaciones: correo propio del
-- dominio cov.com.pe (alias de Zoho) y la nueva dirección de la web en Cloudflare.
alter table public.libro_proveedor
  alter column correo set default 'reclamos@cov.com.pe',
  alter column sitio_web set default 'https://quimiver.cov.com.pe/';

update public.libro_proveedor
set correo = 'reclamos@cov.com.pe', sitio_web = 'https://quimiver.cov.com.pe/';
