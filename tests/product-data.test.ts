import { describe, expect, it } from 'vitest';
import {
  applyProductRow,
  checkProductFields,
  describeProductChange,
  fillPrices,
  parseProductRow,
  type ProductData,
} from '../src/lib/product-data';
import json from '../src/content/products/quimiver.json';

const valid = {
  presentacion: '  Frasco de   50 g ',
  precio: '27,50',
  precio_mayor: '22',
  minimo_mayor: '6',
  descripcion_corta: 'QUIMIVER es elaborado por CELGIMED.',
  descripcion_google:
    'QUIMIVER es un producto de CELGIMED elaborado a base de congona de Huaraz. Pide por WhatsApp.',
};

describe('checkProductFields', () => {
  it('limpia espacios y acepta coma decimal', () => {
    const r = checkProductFields(valid);
    expect(r).toEqual({
      ok: true,
      data: {
        ...valid,
        presentacion: 'Frasco de 50 g',
        precio: 27.5,
        precio_mayor: 22,
        minimo_mayor: 6,
      },
    });
  });

  it('rechaza precio por mayor más alto, mínimos fuera de rango y textos cortos', () => {
    const r = checkProductFields({
      ...valid,
      precio: '20',
      precio_mayor: '25',
      minimo_mayor: '1.5',
      descripcion_google: 'muy corta',
      presentacion: '',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual([
      'descripcion_google',
      'minimo_mayor',
      'precio_mayor',
      'presentacion',
    ]);
    expect(r.errors.precio_mayor).toMatch(/no puede ser mayor/);
  });

  it('rechaza precios que no son números o son cero', () => {
    const r = checkProductFields({ ...valid, precio: 'abc', precio_mayor: '0' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['precio', 'precio_mayor']);
  });
});

describe('parseProductRow', () => {
  it('lee la fila de PostgREST (números como texto) y descarta lo que no cuadra', () => {
    const row = {
      ...valid,
      precio: '27.00',
      precio_mayor: 21,
      actualizado_en: '2026-10-11T19:00:00+00:00',
    };
    expect(parseProductRow([row])).toMatchObject({ precio: 27, precio_mayor: 21, minimo_mayor: 6 });
    expect(parseProductRow([])).toBeNull();
    expect(parseProductRow([{ ...row, actualizado_en: undefined }])).toBeNull();
    expect(parseProductRow([{ ...row, precio: -1 }])).toBeNull();
  });
});

describe('applyProductRow y fillPrices', () => {
  const row = parseProductRow({
    ...valid,
    presentacion: 'Pote de 50 g',
    precio: 27,
    precio_mayor: 21.5,
    minimo_mayor: 12,
    actualizado_en: '2026-10-11T19:00:00+00:00',
  })!;
  const product = applyProductRow(json as unknown as ProductData, row);

  it('cambia la primera presentación, el mínimo y los textos, y deja el resto', () => {
    expect(product.presentations[0]).toEqual({
      id: '50g',
      label: 'Pote de 50 g',
      price: 27,
      wholesalePrice: 21.5,
    });
    expect(product.wholesaleMinQuantity).toBe(12);
    expect(product.intro).toBe(valid.descripcion_corta);
    expect(product.seo).toEqual({ title: json.seo.title, description: valid.descripcion_google });
    expect(product.updatedAt).toBe('2026-10-11T19:00:00+00:00');
  });

  it('las preguntas frecuentes usan los precios vigentes', () => {
    const answers = json.faq.map((f) => fillPrices(f.answer, product)).join(' ');
    expect(answers).toContain('pote de 50 g, a S/ 27.00 por unidad');
    expect(answers).toContain('Desde 12 unidades el precio es de S/ 21.50');
    expect(answers).not.toMatch(/\{\w+\}/);
    const today = json.faq.map((f) => fillPrices(f.answer, json)).join(' ');
    expect(today).toContain('frasco de 50 g, a S/ 25.00 por unidad. Desde 6 unidades');
  });
});

describe('describeProductChange', () => {
  it('describe cada campo cambiado', () => {
    expect(
      describeProductChange(
        { precio: 25, minimo_mayor: 6, presentacion: 'Frasco' },
        { precio: 27.5, minimo_mayor: 12, presentacion: 'Pote' },
      ),
    ).toEqual([
      'Precio: S/ 25.00 → S/ 27.50',
      'Mínimo por mayor: 6 → 12',
      'Presentación: «Frasco» → «Pote»',
    ]);
  });
});
