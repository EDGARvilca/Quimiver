import { describe, expect, it } from 'vitest';
import {
  ORDER_STATES,
  countByState,
  customerNotice,
  customerWhatsApp,
  exportFileName,
  filterByState,
  firstName,
  formatOrderDate,
  isOrderState,
  isStockError,
  limaDateTime,
  monthLabel,
  ordersToRows,
  parseStockAdjustment,
  plural,
  summarizeSales,
  stockLevel,
  trackingLink,
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

describe('exportar pedidos', () => {
  it('pone un pedido por fila con la hora de Lima y montos como números', () => {
    const rows = ordersToRows([{ ...order(7, 'pagado'), notas_internas: 'Yape' }]);
    expect(rows[0][0]).toBe('Pedido');
    expect(rows[1]).toEqual([
      'P-000007',
      '2026-10-06 10:30',
      'Pagado',
      'Cliente',
      '987654321',
      'Lima',
      'Pote 50 g',
      1,
      25,
      'menudeo',
      'Recojo en Lima',
      25,
      null,
      'Yape',
    ]);
    expect(rows[0]).toHaveLength(rows[1].length);
  });

  it('usa la fecha de Lima en el nombre del archivo', () => {
    // 03:00 UTC del 7 es todavía el 6 en Lima.
    const now = new Date('2026-10-07T03:00:00Z');
    expect(limaDateTime(now.toISOString())).toBe('2026-10-06 22:00');
    expect(exportFileName('todos', now)).toBe('pedidos-quimiver-2026-10-06.xlsx');
    expect(exportFileName('pagado', now)).toBe('pedidos-quimiver-pagado-2026-10-06.xlsx');
  });
});

describe('aviso al cliente', () => {
  const base = { codigo: 'P-000007', cliente_nombre: '  María López ', entrega: 'Envío por Olva' };
  const url = 'https://edgarvilca.github.io/Quimiver/seguimiento/?pedido=P-000007';

  it('saluda por el nombre y dice el estado con el enlace de seguimiento', () => {
    expect(customerNotice({ ...base, estado: 'enviado' }, url)).toBe(
      [
        'Hola María, te escribimos de QUIMIVER.',
        'Tu pedido P-000007: *Enviado*.',
        'Tu pedido va en camino. Por WhatsApp te enviamos los datos del envío.',
        `Puedes ver cómo va aquí: ${url}`,
      ].join('\n'),
    );
  });

  it('usa "Listo para recoger" en recojos y avisa la cancelación', () => {
    expect(
      customerNotice({ ...base, estado: 'enviado', entrega: 'Recojo en Lima' }, url),
    ).toContain('*Listo para recoger*');
    expect(customerNotice({ ...base, estado: 'cancelado' }, url)).toContain('*Cancelado*');
  });

  it('arma el enlace de seguimiento y lo pone en el mensaje de WhatsApp', () => {
    const link = trackingLink('https://edgarvilca.github.io', '/Quimiver/seguimiento/', 'P-000007');
    expect(link).toBe(url);
    const wa = customerWhatsApp(
      '987654321',
      'P-000007',
      customerNotice({ ...base, estado: 'pagado' }, link),
    );
    expect(wa.startsWith('https://wa.me/51987654321?text=')).toBe(true);
    expect(decodeURIComponent(wa.split('text=')[1])).toContain(url);
    expect(firstName('')).toBe('');
  });
});
