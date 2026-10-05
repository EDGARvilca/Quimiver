import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pages } from '../config/pages';
import { productPath } from '../lib/paths';

/**
 * Sitemap mínimo. El protocolo exige URLs absolutas, así que sin SITE_URL
 * se genera vacío.
 */
export const GET: APIRoute = async ({ site }) => {
  const products = await getCollection('products');
  const paths = [
    pages.home,
    ...products.map((p) => productPath(p.id)),
    pages.shipping,
    pages.contact,
  ];
  const urls = site ? paths.map((path) => new URL(path, site).href) : [];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
