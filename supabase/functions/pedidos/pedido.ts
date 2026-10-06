/**
 * Registro de pedidos: validación de lo que envía el formulario de compra.
 *
 * TypeScript puro, sin dependencias: lo usan el sitio, la Edge Function (Deno) y las pruebas.
 * Las reglas coinciden con la tabla `pedidos`. Los importes son la estimación que vio el
 * cliente; el precio final y el envío se confirman por WhatsApp.
 */

export const ORDER_STATES = [
  'nuevo',
  'confirmado',
  'pagado',
  'enviado',
  'entregado',
  'cancelado',
] as const;

export interface OrderRecord {
  cliente_nombre: string;
  telefono: string;
  ciudad: string;
  presentacion: string;
  cantidad: number;
  precio_unitario: number;
  tipo_precio: 'menudeo' | 'por mayor';
  entrega: string;
  total_estimado: number;
  observaciones: string | null;
}

export type OrderValidation =
  { ok: true; value: OrderRecord } | { ok: false; errors: Record<string, string> };

export const MAX_QUANTITY = 10000;

function text(input: unknown, max: number): string {
  return typeof input === 'string' ? input.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function money(input: unknown): number | null {
  const value = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(value) && value >= 0 && value <= 10_000_000
    ? Math.round(value * 100) / 100
    : null;
}

/** Valida y normaliza el pedido. Nunca confía en el navegador. */
export function validateOrder(input: unknown): OrderValidation {
  const data = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const errors: Record<string, string> = {};

  const cliente_nombre = text(data.cliente_nombre, 120);
  if (cliente_nombre.length < 2) errors.cliente_nombre = 'Escribe tu nombre.';

  const telefono = text(data.telefono, 30).replace(/[\s-]/g, '');
  if (!/^\+?\d{6,15}$/.test(telefono)) errors.telefono = 'Escribe un celular válido.';

  const ciudad = text(data.ciudad, 120);
  if (ciudad.length < 2) errors.ciudad = 'Escribe tu ciudad.';

  const presentacion = text(data.presentacion, 80);
  if (presentacion.length < 1) errors.presentacion = 'Elige la presentación.';

  const cantidad = Number(data.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_QUANTITY)
    errors.cantidad = 'Escribe una cantidad válida.';

  const entrega = text(data.entrega, 120);
  if (entrega.length < 1) errors.entrega = 'Elige la forma de entrega.';

  const tipo_precio = data.tipo_precio === 'por mayor' ? 'por mayor' : 'menudeo';
  const precio_unitario = money(data.precio_unitario);
  const total_estimado = money(data.total_estimado);
  if (precio_unitario === null || precio_unitario <= 0)
    errors.precio_unitario = 'Precio no válido.';
  if (total_estimado === null) errors.total_estimado = 'Total no válido.';
  else if (
    precio_unitario !== null &&
    Number.isInteger(cantidad) &&
    total_estimado + 0.01 < precio_unitario * cantidad
  )
    errors.total_estimado = 'El total no coincide con el precio y la cantidad.';

  const notes = text(data.observaciones, 1000);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      cliente_nombre,
      telefono,
      ciudad,
      presentacion,
      cantidad,
      precio_unitario: precio_unitario as number,
      tipo_precio,
      entrega,
      total_estimado: total_estimado as number,
      observaciones: notes === '' ? null : notes,
    },
  };
}
