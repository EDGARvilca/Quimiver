import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';

/**
 * Fecha del último cambio del producto con la que se compiló la web publicada.
 * `.github/workflows/producto.yml` la compara con la de la base y vuelve a publicar si
 * son distintas. "json" = la web se compiló solo con el JSON (desarrollo y pruebas).
 */
export const GET: APIRoute = async () => {
  const entry = await getEntry('products', 'quimiver');
  return new Response(`${entry?.data.updatedAt ?? 'json'}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
