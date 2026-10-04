/**
 * Configuración central del negocio.
 *
 * Todo dato de contacto, envío o pago se define aquí una sola vez.
 * Los valores provienen del sitio original; los que no estaban definidos
 * quedan en `null` y se muestran como pendientes.
 */

import type { ShippingOption } from '../lib/order';

export const PENDING_TEXT = 'DATO PENDIENTE DE DEFINICIÓN';

export interface SocialLink {
  label: string;
  /** `null` mientras no exista la cuenta oficial confirmada. */
  url: string | null;
}

export const site = {
  brand: 'QUIMIVER',
  company: 'Química Verde Andina',
  lang: 'es',
  locale: 'es_PE',
  currency: 'PEN',
  contact: {
    phoneDisplay: '+51 929 445 834',
    phoneHref: 'tel:+51929445834',
    /** Número en formato internacional sin "+", como lo pide wa.me. */
    whatsapp: '51929445834',
    email: 'ventas@quimicaverdeandina.pe',
  },
  payment: {
    methods: 'Yape / Plin',
    number: '929445834',
  },
  social: [
    { label: 'Facebook', url: null },
    { label: 'Instagram', url: null },
    { label: 'TikTok', url: null },
  ] satisfies SocialLink[],
  order: {
    /** Unidades a partir de las cuales se aplica el precio por mayor (media docena). */
    wholesaleMinQuantity: 6,
    /** `fee: null` = el costo depende del destino y se coordina por WhatsApp. */
    shippingOptions: [
      { id: 'recojo-lima', label: 'Recojo en Lima (sin costo)', fee: 0 },
      { id: 'shalom', label: 'Envío por Shalom (costo según destino)', fee: null },
      { id: 'olva', label: 'Envío por Olva (costo según destino)', fee: null },
    ] satisfies ShippingOption[],
  },
} as const;

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
