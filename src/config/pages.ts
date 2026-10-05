import { productPath, withBase } from '../lib/paths';

/** Páginas públicas fijas. Se usan en el menú, el pie de página y el sitemap. */
export const pages = {
  home: withBase('/'),
  product: productPath('quimiver'),
  shipping: withBase('/envios/'),
  contact: withBase('/contacto/'),
  returns: withBase('/cambios-y-devoluciones/'),
  privacy: withBase('/politica-de-privacidad/'),
  complaints: withBase('/libro-de-reclamaciones/'),
  faq: withBase('/#faq'),
  order: withBase('/#compra'),
};
