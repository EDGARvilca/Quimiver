import { describe, expect, it } from 'vitest';
import {
  ORDER_STATES,
  countByState,
  customerWhatsApp,
  filterByState,
  formatOrderDate,
  isOrderState,
  isStockError,
  monthLabel,
  parseStockAdjustment,
  plural,
  summarizeSales,
  stockLevel,
  type PanelOrder,
} from '../src/lib/panel';
import { ORDER_STATES as DB_STATES } from '../supabase/functions/pedidos/pedido';

function order(id: number, estado: PanelOrder['estado']): PanelOrder {
  return {
    id,
    codigo: `P-${String(id).padStart(6, '0')}`,
    creado_en: '2026-10-06T15:30:00Z',
    cliente_nombre: 'Cliente',
    telefono: '987654321',
    ciudad: 'Lima',
    presentacion: 'Pote 50 g',
    cantidad: 1,
    precio_unitario: 25,
    tipo_precio: 'menudeo',
    entrega: 'Recojo en Lima',
    total_estimado: 25,
    observaciones: null,
    estado,
    notas_internas: null,
  };
}

describe('panel de pedidos', () => {
  it('usa los mismos estados que la base de datos', () => {
    expect([...ORDER_STATES]).toEqual([...DB_STATES]);
  });

  it('reconoce solo estados válidos', () => {
    expect(isOrderState('pagado')).toBe(true);
    expect(isOrderState('borrado')).toBe(false);
    expect(isOrderState(3)).toBe(false);
  });

  it('cuenta y filtra por estado', () => {
    const orders = [order(1, 'nuevo'), order(2, 'nuevo'), order(3, 'pagado')];
    const counts = countByState(orders);
    expect(counts.todos).toBe(3);
    expect(counts.nuevo).toBe(2);
    expect(counts.pagado).toBe(1);
    expect(counts.cancelado).toBe(0);
    expect(filterByState(orders, 'todos')).toHaveLength(3);
    expect(filterByState(orders, 'pagado').map((o) => o.id)).toEqual([3]);
  });

  it('muestra la fecha en hora de Lima', () => {
    expect(formatOrderDate('2026-10-06T15:30:00Z')).toContain('10:30');
  });

  it('arma el enlace de WhatsApp al cliente con el 51 de Perú', () => {
    const url = customerWhatsApp('987 654 321', 'P-000007');
    expect(url.startsWith('https://wa.me/51987654321?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toContain('P-000007');
    expect(customerWhatsApp('+51987654321', 'P-1')).toContain('wa.me/51987654321');
  });

  it('clasifica el nivel de stock', () => {
    expect(stockLevel(0)).toBe('agotado');
    expect(stockLevel(10)).toBe('bajo');
    expect(stockLevel(11)).toBe('ok');
  });

  it('valida el ajuste de stock', () => {
    expect(parseStockAdjustment('50', ' Producción ')).toEqual({
      ok: true,
      cantidad: 50,
      motivo: 'Producción',
    });
    expect(parseStockAdjustment('-3', 'Potes dañados')).toMatchObject({ ok: true, cantidad: -3 });
    expect(parseStockAdjustment('0', 'x x').ok).toBe(false);
    expect(parseStockAdjustment('2.5', 'Producción').ok).toBe(false);
    expect(parseStockAdjustment('5', ' ').ok).toBe(false);
  });

  it('reconoce el rechazo por falta de stock', () => {
    expect(isStockError({ code: 'P0001', message: 'Stock insuficiente' })).toBe(true);
    expect(isStockError({ message: 'otra cosa' })).toBe(false);
    expect(isStockError(null)).toBe(false);
  });
});

describe('resumen de ventas', () => {
  const at = (id: number, estado: PanelOrder['estado'], creado_en: string, extra = {}) => ({
    ...order(id, estado),
    creado_en,
    ...extra,
  });
  // Martes 6 de octubre de 2026, 10:00 en Lima.
  const now = new Date('2026-10-06T15:00:00Z');

  it('cuenta solo los pedidos confirmados en adelante', () => {
    const s = summarizeSales(
      [
        at(1, 'nuevo', '2026-10-06T14:00:00Z'),
        at(2, 'cancelado', '2026-10-06T14:00:00Z'),
        at(3, 'confirmado', '2026-10-06T14:00:00Z', { cantidad: 6, total_estimado: 120 }),
        at(4, 'entregado', '2026-10-05T14:00:00Z'),
      ],
      now,
    );
    expect(s.total).toEqual({ pedidos: 2, potes: 7, soles: 145 });
  });

  it('separa semana (desde el lunes, hora de Lima) y mes', () => {
    const s = summarizeSales(
      [
        // Lunes 5 a las 00:30 en Lima (05:30 UTC): esta semana.
        at(1, 'pagado', '2026-10-05T05:30:00Z'),
        // Domingo 4 a las 23:30 en Lima (lunes 04:30 UTC): semana pasada, mismo mes.
        at(2, 'pagado', '2026-10-05T04:30:00Z'),
        // 30 de septiembre: mes pasado.
        at(3, 'pagado', '2026-09-30T20:00:00Z'),
      ],
      now,
    );
    expect(s.semana.pedidos).toBe(1);
    expect(s.mes.pedidos).toBe(2);
    expect(s.meses[0]).toMatchObject({ mes: '2026-10', pedidos: 2 });
    expect(s.meses[1]).toMatchObject({ mes: '2026-09', pedidos: 1 });
    expect(s.meses).toHaveLength(6);
    expect(s.meses[5].mes).toBe('2026-05');
  });

  it('ordena las ciudades por potes vendidos sin importar mayúsculas', () => {
    const s = summarizeSales(
      [
        at(1, 'pagado', '2026-10-06T14:00:00Z', { ciudad: 'Huaraz', cantidad: 2 }),
        at(2, 'pagado', '2026-10-06T14:00:00Z', { ciudad: 'huaraz ', cantidad: 3 }),
        at(3, 'pagado', '2026-10-06T14:00:00Z', { ciudad: 'Lima', cantidad: 4 }),
      ],
      now,
    );
    expect(s.ciudades.map((c) => [c.ciudad, c.potes])).toEqual([
      ['Huaraz', 5],
      ['Lima', 4],
    ]);
  });

  it('usa singular y plural', () => {
    expect(plural(1, 'pote', 'potes')).toBe('1 pote');
    expect(plural(0, 'pote', 'potes')).toBe('0 potes');
  });

  it('nombra los meses en español', () => {
    expect(monthLabel('2026-10')).toBe('octubre de 2026');
  });
});
