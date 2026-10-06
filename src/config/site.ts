/**
 * Configuración central del negocio.
 *
 * Todo dato de contacto, envío o pago se define aquí una sola vez.
 * Los valores provienen del sitio original; los que no estaban definidos
 * quedan en `null` y no se muestran.
 */

import type { ShippingOption } from '../lib/order';

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
    /** Horario de atención; `null` lo oculta hasta que el negocio lo defina. */
    hours: null as string | null,
  },
  payment: {
    methods: 'Yape / Plin',
    number: '929445834',
  },
  /**
   * Datos legales del proveedor (Código de Protección y Defensa del Consumidor
   * y Ley 29733). `null` los oculta hasta que el negocio los confirme.
   */
  legal: {
    businessName: 'Edgar Luis Vilcapoma Orihuela' as string | null,
    ruc: '10746979156' as string | null,
    address: 'Av. Enrique Guzmán y Valle - La Cantuta, Lurigancho-Chosica, Lima' as string | null,
  },
  /** Registro de pedidos (Edge Function de Supabase; dirección pública, no es una clave). */
  orders: {
    endpoint: 'https://buuelzmvfidigimbrplm.supabase.co/functions/v1/pedidos',
  },
  /**
   * Panel privado de pedidos (/panel/). La clave publicable de Supabase es pública por diseño:
   * sin sesión de un administrador no da acceso a ningún dato (reglas RLS de la tabla `pedidos`).
   */
  panel: {
    supabaseUrl: 'https://buuelzmvfidigimbrplm.supabase.co',
    publishableKey: 'sb_publishable_q2FSVRBLl-JMvXjPXWchXw_ZFoBAMwW',
  },
  /**
   * Libro de Reclamaciones virtual (D.S. 011-2011-PCM). Las hojas se guardan en Supabase
   * mediante esta Edge Function (dirección pública, no es una clave).
   * Se muestra en el sitio solo cuando razón social, RUC y domicilio están completos.
   */
  complaintsBook: {
    endpoint: 'https://buuelzmvfidigimbrplm.supabase.co/functions/v1/libro-reclamaciones',
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
      { id: 'recojo-lima', label: 'Recojo en Lima (costo según zona)', fee: null },
      { id: 'shalom', label: 'Envío por Shalom (costo según destino)', fee: null },
      { id: 'olva', label: 'Envío por Olva (costo según destino)', fee: null },
    ] satisfies ShippingOption[],
  },
} as const;

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** El libro se anuncia en el sitio solo cuando la hoja puede llevar los datos legales del proveedor. */
export const complaintsBookEnabled = Boolean(
  site.legal.businessName && site.legal.ruc && site.legal.address,
);
