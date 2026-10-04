// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL es opcional: si se define, Astro genera URLs canónicas absolutas.
// Ver .env.example.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
});
