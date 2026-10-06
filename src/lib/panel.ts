/**
 * Lógica pura del panel de pedidos (sin DOM), para poder probarla.
 */

export const ORDER_STATES = [
  'nuevo',
  'confirmado',
  'pagado',
  'enviado',
  'entregado',
  'cancelado',
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const STATE_LABELS: Record<OrderState, string> = {
  nuevo: 'Nuevo',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export interface PanelOrder {
  id: number;
  codigo: string;
  creado_en: string;
  cliente_nombre: string;
  telefono: string;
  ciudad: string;
  presentacion: string;
  cantidad: number;
  precio_unitario: number;
  tipo_precio: string;
  entrega: string;
  total_estimado: number;
  observaciones: string | null;
  estado: OrderState;
  notas_internas: string | null;
}

export function isOrderState(value: unknown): value is OrderState {
  return typeof value === 'string' && (ORDER_STATES as readonly string[]).includes(value);
}

/** Cantidad de pedidos por estado, con el total en `todos`. */
export function countByState(orders: PanelOrder[]): Record<OrderState | 'todos', number> {
  const counts = Object.fromEntries(ORDER_STATES.map((s) => [s, 0])) as Record<
    OrderState | 'todos',
    number
  >;
  counts.todos = orders.length;
  for (const order of orders) counts[order.estado] += 1;
  return counts;
}

export function filterByState(orders: PanelOrder[], state: OrderState | 'todos'): PanelOrder[] {
  return state === 'todos' ? orders : orders.filter((o) => o.estado === state);
}

/** Fecha y hora en Lima, corta, para la lista. */
export function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Enlace de WhatsApp al cliente; agrega el 51 de Perú a celulares de 9 dígitos. */
export function customerWhatsApp(phone: string, code: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length === 9 ? `51${digits}` : digits;
  const text = `Hola, te escribimos de QUIMIVER por tu pedido ${code}.`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
