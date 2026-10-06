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

/** Desde cuántos potes el panel avisa que quedan pocos. */
export const LOW_STOCK = 10;

export function stockLevel(stock: number): 'agotado' | 'bajo' | 'ok' {
  if (stock <= 0) return 'agotado';
  return stock <= LOW_STOCK ? 'bajo' : 'ok';
}

export interface StockMove {
  cantidad: number;
  stock_resultante: number;
  motivo: string;
  creado_en: string;
}

/** Valida el formulario de ajuste: entero distinto de 0 (negativo para corregir) y un motivo. */
export function parseStockAdjustment(
  rawQuantity: string,
  rawReason: string,
): { ok: true; cantidad: number; motivo: string } | { ok: false; error: string } {
  const cantidad = Number(rawQuantity);
  const motivo = rawReason.trim();
  if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 100000) {
    return { ok: false, error: 'Escribe cuántos potes sumas (o restas con un signo menos).' };
  }
  if (motivo.length < 2)
    return { ok: false, error: 'Escribe el motivo, por ejemplo "Producción".' };
  return { ok: true, cantidad, motivo: motivo.slice(0, 200) };
}

/** Mensaje para el administrador cuando la base rechaza un cambio por falta de stock. */
export function isStockError(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { message?: unknown }).message === 'Stock insuficiente'
  );
}
