/**
 * Seguimiento de pedidos para clientes (lógica pura, sin DOM).
 * La base de datos (`seguir_pedido`) decide qué datos devuelve; aquí solo se valida la
 * entrada y se traduce el estado a palabras para el cliente.
 */

import type { OrderState } from './panel';

/** Normaliza "p-12", "12" o "P-000012" a "P-000012"; null si no parece un número de pedido. */
export function normalizeOrderCode(value: string): string | null {
  const clean = value.replace(/\s/g, '').toUpperCase();
  const match = /^(?:P-?)?(\d{1,6})$/.exec(clean);
  return match ? `P-${match[1].padStart(6, '0')}` : null;
}

/** Celular con 6 a 15 dígitos (se aceptan espacios, guiones y +51). */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export interface TrackedOrder {
  codigo: string;
  estado: OrderState;
  creado_en: string;
  presentacion: string;
  cantidad: number;
  entrega: string;
  total_estimado: number;
}

export type TrackingResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; error: 'datos' | 'no_encontrado' | 'limite' | 'conexion' };

/** Interpreta la respuesta de `seguir_pedido` sin confiar en su forma. */
export function parseTrackingResponse(body: unknown): TrackingResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'conexion' };
  const data = body as Record<string, unknown>;
  if (data.ok === true && typeof data.codigo === 'string' && typeof data.estado === 'string') {
    return {
      ok: true,
      order: {
        codigo: data.codigo,
        estado: data.estado as OrderState,
        creado_en: String(data.creado_en ?? ''),
        presentacion: String(data.presentacion ?? ''),
        cantidad: Number(data.cantidad ?? 0),
        entrega: String(data.entrega ?? ''),
        total_estimado: Number(data.total_estimado ?? 0),
      },
    };
  }
  const error = data.error;
  if (error === 'datos' || error === 'no_encontrado' || error === 'limite') {
    return { ok: false, error };
  }
  return { ok: false, error: 'conexion' };
}

export const TRACKING_ERRORS: Record<Exclude<TrackingResult, { ok: true }>['error'], string> = {
  datos: 'Revisa el número de pedido (por ejemplo P-000123) y tu celular.',
  no_encontrado:
    'No encontramos un pedido con ese número y ese celular. Usa el mismo celular con el que hiciste el pedido.',
  limite:
    'Hubo muchos intentos con este pedido. Vuelve a intentarlo en una hora o escríbenos por WhatsApp.',
  conexion: 'No pudimos consultar tu pedido. Revisa tu conexión e inténtalo de nuevo.',
};

/** Es recojo si la forma de entrega lo dice (p. ej. "Recojo en Lima"). */
export function isPickup(entrega: string): boolean {
  return /recojo/i.test(entrega);
}

export interface TrackingStep {
  state: Exclude<OrderState, 'cancelado'>;
  label: string;
  /** "hecho", "actual" o "pendiente". */
  status: 'hecho' | 'actual' | 'pendiente';
}

const STEP_ORDER: Exclude<OrderState, 'cancelado'>[] = [
  'nuevo',
  'confirmado',
  'pagado',
  'enviado',
  'entregado',
];

/** Pasos del pedido para la línea de avance. Un pedido cancelado no tiene pasos. */
export function trackingSteps(order: Pick<TrackedOrder, 'estado' | 'entrega'>): TrackingStep[] {
  if (order.estado === 'cancelado') return [];
  const pickup = isPickup(order.entrega);
  const labels: Record<TrackingStep['state'], string> = {
    nuevo: 'Recibido',
    confirmado: 'Confirmado',
    pagado: 'Pagado',
    enviado: pickup ? 'Listo para recoger' : 'Enviado',
    entregado: 'Entregado',
  };
  const current = STEP_ORDER.indexOf(order.estado);
  return STEP_ORDER.map((state, i) => ({
    state,
    label: labels[state],
    status: i < current ? 'hecho' : i === current ? 'actual' : 'pendiente',
  }));
}

/** Frase para el cliente según el estado actual. */
export function trackingMessage(order: Pick<TrackedOrder, 'estado' | 'entrega'>): string {
  const pickup = isPickup(order.entrega);
  switch (order.estado) {
    case 'nuevo':
      return 'Recibimos tu pedido. Te escribiremos por WhatsApp para confirmarlo.';
    case 'confirmado':
      return 'Confirmamos tu pedido. Coordinamos el pago contigo por WhatsApp.';
    case 'pagado':
      return pickup
        ? 'Recibimos tu pago. Estamos preparando tu pedido para que lo recojas.'
        : 'Recibimos tu pago. Estamos preparando tu envío.';
    case 'enviado':
      return pickup
        ? 'Tu pedido está listo para recoger. Por WhatsApp te confirmamos el lugar y la hora.'
        : 'Tu pedido va en camino. Por WhatsApp te enviamos los datos del envío.';
    case 'entregado':
      return 'Tu pedido fue entregado. ¡Gracias por tu compra!';
    case 'cancelado':
      return 'Este pedido fue cancelado. Si tienes dudas, escríbenos por WhatsApp.';
    default:
      return 'Escríbenos por WhatsApp para saber cómo va tu pedido.';
  }
}
