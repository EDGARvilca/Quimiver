/**
 * Construye una ruta interna respetando `base` (p. ej. "/Quimiver" en GitHub Pages).
 * `withBase('/productos/quimiver/')` → "/Quimiver/productos/quimiver/".
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function productPath(slug: string): string {
  return withBase(`/productos/${slug}/`);
}
