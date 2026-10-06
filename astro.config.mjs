// @ts-check
import { defineConfig } from 'astro/config';

// Variables opcionales (ver .env.example):
// - SITE_URL: URL pública sin barra final; activa canonical y og:url.
// - BASE_PATH: subcarpeta donde se sirve el sitio, p. ej. "/Quimiver" en GitHub Pages.
const site = process.env.SITE_URL || undefined;
const base = process.env.BASE_PATH || undefined;

export default defineConfig({
  site,
  base,
  // El sitio no muestra código; sin resaltado no hay estilos en línea que choquen con la CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // Política de seguridad de contenido (CSP) en una etiqueta <meta> de cada página: solo se
    // ejecutan los scripts del propio sitio (Astro calcula sus huellas) y el navegador solo
    // puede conectarse a Supabase. GitHub Pages no permite cabeceras propias.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://buuelzmvfidigimbrplm.supabase.co",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      // Las fotos usan style="object-position: …" para el encuadre.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
});
