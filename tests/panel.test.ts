import { describe, expect, it } from 'vitest';
import {
  ORDER_STATES,
  countByState,
  customerWhatsApp,
  filterByState,
  formatOrderDate,
  isOrderState,
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
});
