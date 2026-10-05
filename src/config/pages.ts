import { productPath, withBase } from '../lib/paths';

/** Páginas públicas fijas. Se usan en el menú, el pie de página y el sitemap. */
export const pages = {
  home: withBase('/'),
  product: productPath('quimiver'),
  shipping: withBase('/envios/'),
  contact: withBase('/contacto/'),
  faq: withBase('/#faq'),
  order: withBase('/#compra'),
};
