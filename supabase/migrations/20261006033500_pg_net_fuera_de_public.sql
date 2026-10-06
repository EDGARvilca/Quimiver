-- pg_net (peticiones HTTP desde la base, usado para pruebas en vivo) se instaló en el esquema
-- public. El asesor de seguridad pide sacarlo de ahí: se reinstala en `extensions`.
-- Sus funciones siguen en el esquema `net`; no lo usa ninguna tabla ni función del sitio.
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
