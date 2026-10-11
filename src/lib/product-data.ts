/**
 * Datos del producto que se editan desde el panel (tabla `producto_web` en Supabase).
 * Lógica pura: validar lo que escribe el administrador, leer la fila de la base y
 * aplicarla sobre `src/content/products/quimiver.json` al compilar la web.
 */

import { formatCurrency } from './order';

export const PRODUCT_ROW_ID = 'quimiver-50g';

export interface ProductRow {
  presentacion: string;
  precio: number;
  precio_mayor: number;
  minimo_mayor: number;
  descripcion_corta: string;
  descripcion_google: string;
  actualizado_en: string;
}

export type ProductFields = Omit<ProductRow, 'actualizado_en'>;

/** Límites iguales a los de la base (migración producto_editable). */
export const PRODUCT_LIMITS = {
  presentacion: [2, 60],
  descripcion_corta: [10, 300],
  descripcion_google: [50, 160],
  precio: [0.01, 10000],
  minimo_mayor: [2, 1000],
} as const;

const money = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Revisa lo que se va a guardar; devuelve los datos limpios o un mensaje por campo. */
export function checkProductFields(
  input: Record<string, unknown>,
):
  | { ok: true; data: ProductFields }
  | { ok: false; errors: Partial<Record<keyof ProductFields, string>> } {
  const errors: Partial<Record<keyof ProductFields, string>> = {};
  const text = (key: 'presentacion' | 'descripcion_corta' | 'descripcion_google') => {
    const value = String(input[key] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const [min, max] = PRODUCT_LIMITS[key];
    if (value.length < min || value.length > max) {
      errors[key] = `Escribe entre ${min} y ${max} caracteres (ahora tiene ${value.length}).`;
    }
    return value;
  };
  const presentacion = text('presentacion');
  const descripcion_corta = text('descripcion_corta');
  const descripcion_google = text('descripcion_google');

  const [minPrice, maxPrice] = PRODUCT_LIMITS.precio;
  const precio = money(input.precio);
  if (precio === null || precio < minPrice || precio > maxPrice) {
    errors.precio = 'Escribe un precio válido, por ejemplo 25 o 25.50.';
  }
  const precio_mayor = money(input.precio_mayor);
  if (precio_mayor === null || precio_mayor < minPrice || precio_mayor > maxPrice) {
    errors.precio_mayor = 'Escribe un precio válido, por ejemplo 20.';
  } else if (precio !== null && precio_mayor > precio) {
    errors.precio_mayor = 'El precio por mayor no puede ser mayor que el precio por unidad.';
  }
  const minimo = Number(input.minimo_mayor);
  const [minQty, maxQty] = PRODUCT_LIMITS.minimo_mayor;
  if (!Number.isInteger(minimo) || minimo < minQty || minimo > maxQty) {
    errors.minimo_mayor = `Escribe un número entero entre ${minQty} y ${maxQty}.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      presentacion,
      precio: precio as number,
      precio_mayor: precio_mayor as number,
      minimo_mayor: minimo,
      descripcion_corta,
      descripcion_google,
    },
  };
}

/** Lee la fila de la base sin confiar en su forma; null si algo no cuadra. */
export function parseProductRow(body: unknown): ProductRow | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const checked = checkProductFields(r);
  if (!checked.ok || typeof r.actualizado_en !== 'string') return null;
  return { ...checked.data, actualizado_en: r.actualizado_en };
}

export interface ProductData {
  intro: string;
  seo: { title: string; description: string };
  presentations: { id: string; label: string; price: number; wholesalePrice: number }[];
  wholesaleMinQuantity: number;
  updatedAt?: string;
}

/** Aplica la fila de la base sobre los datos del JSON (la primera presentación). */
export function applyProductRow<T extends ProductData>(data: T, row: ProductRow): T {
  const [first, ...rest] = data.presentations;
  return {
    ...data,
    intro: row.descripcion_corta,
    seo: { ...data.seo, description: row.descripcion_google },
    presentations: [
      { ...first, label: row.presentacion, price: row.precio, wholesalePrice: row.precio_mayor },
      ...rest,
    ],
    wholesaleMinQuantity: row.minimo_mayor,
    updatedAt: row.actualizado_en,
  };
}

/** Cambia {presentacion}, {precio}, {precio_mayor} y {minimo_mayor} en los textos (p. ej. preguntas frecuentes). */
export function fillPrices(
  text: string,
  product: Pick<ProductData, 'presentations' | 'wholesaleMinQuantity'>,
): string {
  const [first] = product.presentations;
  return text
    .replaceAll(
      '{presentacion}',
      first.label.charAt(0).toLocaleLowerCase('es-PE') + first.label.slice(1),
    )
    .replaceAll('{precio}', formatCurrency(first.price))
    .replaceAll('{precio_mayor}', formatCurrency(first.wholesalePrice))
    .replaceAll('{minimo_mayor}', String(product.wholesaleMinQuantity));
}

/** Nombre corto de cada campo, para el historial del panel. */
export const PRODUCT_FIELD_LABELS: Record<keyof ProductFields, string> = {
  presentacion: 'Presentación',
  precio: 'Precio',
  precio_mayor: 'Precio por mayor',
  minimo_mayor: 'Mínimo por mayor',
  descripcion_corta: 'Descripción corta',
  descripcion_google: 'Descripción para Google',
};

/** "Precio: S/ 25.00 → S/ 27.00" por cada campo cambiado. */
export function describeProductChange(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): string[] {
  const show = (key: string, value: unknown) =>
    key === 'precio' || key === 'precio_mayor'
      ? formatCurrency(Number(value))
      : key === 'minimo_mayor'
        ? String(value)
        : `«${String(value)}»`;
  return Object.keys(despues)
    .filter((key): key is keyof ProductFields => key in PRODUCT_FIELD_LABELS)
    .map(
      (key) =>
        `${PRODUCT_FIELD_LABELS[key]}: ${show(key, antes[key])} → ${show(key, despues[key])}`,
    );
}
