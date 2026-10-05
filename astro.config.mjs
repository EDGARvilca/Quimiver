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
});
