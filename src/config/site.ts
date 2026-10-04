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
    maxQuantity: 10,
    shippingOptions: [
      { id: 'Recojo en Lima', label: 'Recojo en Lima (sin costo)', fee: 0 },
      { id: 'Envio Lima', label: 'Envío Lima Metropolitana (+S/ 10)', fee: 10 },
      { id: 'Envio provincias', label: 'Envío a provincias (+S/ 15)', fee: 15 },
    ] satisfies ShippingOption[],
  },
} as const;

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
