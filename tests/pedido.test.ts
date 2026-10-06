import { describe, expect, it } from 'vitest';
import { validateOrder } from '../supabase/functions/pedidos/pedido';

const valid = {
  cliente_nombre: '  Ana   Pérez ',
  telefono: '929 445-834',
  ciudad: 'Huaraz',
  presentacion: 'Frasco de 50 g',
  cantidad: 6,
  precio_unitario: 20,
  tipo_precio: 'por mayor',
  entrega: 'Envío por Shalom (costo según destino)',
  total_estimado: 120,
  observaciones: '',
};

describe('validateOrder', () => {
  it('normaliza un pedido válido', () => {
    const result = validateOrder(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cliente_nombre).toBe('Ana Pérez');
    expect(result.value.telefono).toBe('929445834');
    expect(result.value.observaciones).toBeNull();
    expect(result.value.tipo_precio).toBe('por mayor');
  });

  it('rechaza datos vacíos o fuera de rango', () => {
    const result = validateOrder({ ...valid, cliente_nombre: '', telefono: 'abc', cantidad: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['cantidad', 'cliente_nombre', 'telefono']);
  });

  it('rechaza un total menor que precio por cantidad', () => {
    const result = validateOrder({ ...valid, total_estimado: 50 });
    expect(result.ok).toBe(false);
  });

  it('rechaza cantidades no enteras y entradas que no son objetos', () => {
    expect(validateOrder({ ...valid, cantidad: 1.5 }).ok).toBe(false);
    expect(validateOrder(null).ok).toBe(false);
  });
});
