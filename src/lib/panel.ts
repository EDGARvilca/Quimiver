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

/** Estados que cuentan como venta (los mismos que descuentan stock en la base). */
export const SALE_STATES: readonly OrderState[] = ['confirmado', 'pagado', 'enviado', 'entregado'];

export interface SalesTotals {
  pedidos: number;
  potes: number;
  soles: number;
}

export interface SalesSummary {
  semana: SalesTotals;
  mes: SalesTotals;
  total: SalesTotals;
  /** Últimos 6 meses, del más reciente al más antiguo; `mes` es "2026-10". */
  meses: (SalesTotals & { mes: string })[];
  /** Ciudades con más potes vendidos (hasta 5). */
  ciudades: (SalesTotals & { ciudad: string })[];
}

/** Fecha de calendario en Lima como "2026-10-06". */
function limaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Lunes de la semana (en Lima) de una fecha "aaaa-mm-dd". */
function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

const empty = (): SalesTotals => ({ pedidos: 0, potes: 0, soles: 0 });

function add(t: SalesTotals, o: PanelOrder): void {
  t.pedidos += 1;
  t.potes += o.cantidad;
  t.soles = Math.round((t.soles + Number(o.total_estimado)) * 100) / 100;
}

/** Resumen de ventas a partir de los pedidos; los montos son los estimados (sin envío). */
export function summarizeSales(orders: PanelOrder[], now: Date = new Date()): SalesSummary {
  const today = limaDate(now);
  const week = mondayOf(today);
  const month = today.slice(0, 7);

  const months: string[] = [];
  const cursor = new Date(`${month}-15T12:00:00Z`);
  for (let i = 0; i < 6; i++) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  const summary: SalesSummary = {
    semana: empty(),
    mes: empty(),
    total: empty(),
    meses: months.map((m) => ({ mes: m, ...empty() })),
    ciudades: [],
  };
  const cities = new Map<string, SalesTotals & { ciudad: string }>();

  for (const o of orders) {
    if (!SALE_STATES.includes(o.estado)) continue;
    const day = limaDate(new Date(o.creado_en));
    add(summary.total, o);
    if (day >= week && day <= today) add(summary.semana, o);
    if (day.startsWith(month)) add(summary.mes, o);
    const row = summary.meses.find((m) => day.startsWith(m.mes));
    if (row) add(row, o);
    const key = o.ciudad.trim().toLocaleLowerCase('es-PE');
    if (!cities.has(key)) cities.set(key, { ciudad: o.ciudad.trim(), ...empty() });
    add(cities.get(key)!, o);
  }

  summary.ciudades = [...cities.values()].sort((a, b) => b.potes - a.potes).slice(0, 5);
  return summary;
}

/** "2026-10" → "octubre 2026". */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`));
}

/** "1 pote", "6 potes". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Fecha y hora en Lima como "2026-10-06 14:05", para Excel. */
export function limaDateTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export const EXPORT_COLUMNS: { title: string; width: number }[] = [
  { title: 'Pedido', width: 11 },
  { title: 'Fecha (Lima)', width: 17 },
  { title: 'Estado', width: 12 },
  { title: 'Cliente', width: 26 },
  { title: 'Teléfono', width: 14 },
  { title: 'Ciudad', width: 16 },
  { title: 'Presentación', width: 14 },
  { title: 'Potes', width: 7 },
  { title: 'Precio por pote (S/)', width: 12 },
  { title: 'Tipo de precio', width: 14 },
  { title: 'Entrega', width: 22 },
  { title: 'Total estimado (S/)', width: 12 },
  { title: 'Observaciones del cliente', width: 34 },
  { title: 'Notas internas', width: 34 },
];

/** Filas para Excel: encabezado y un pedido por fila, montos como números. */
export function ordersToRows(orders: PanelOrder[]): (string | number | null)[][] {
  return [
    EXPORT_COLUMNS.map((c) => c.title),
    ...orders.map((o) => [
      o.codigo,
      limaDateTime(o.creado_en),
      STATE_LABELS[o.estado] ?? o.estado,
      o.cliente_nombre,
      o.telefono,
      o.ciudad,
      o.presentacion,
      o.cantidad,
      o.precio_unitario,
      o.tipo_precio,
      o.entrega,
      o.total_estimado,
      o.observaciones,
      o.notas_internas,
    ]),
  ];
}

/** Nombre del archivo: pedidos-quimiver-2026-10-06.xlsx (o con el estado filtrado). */
export function exportFileName(state: OrderState | 'todos', now: Date = new Date()): string {
  const day = limaDateTime(now.toISOString()).slice(0, 10);
  const suffix = state === 'todos' ? '' : `-${state}`;
  return `pedidos-quimiver${suffix}-${day}.xlsx`;
}
