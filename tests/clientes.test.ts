import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_COLUMNS,
  customerKey,
  customersToRows,
  filterCustomers,
  summarizeCustomers,
  type PanelOrder,
} from '../src/lib/panel';

let next = 1;
function order(over: Partial<PanelOrder>): PanelOrder {
  const id = next++;
  return {
    id,
    codigo: `P-${String(id).padStart(6, '0')}`,
    creado_en: '2026-10-06T15:30:00Z',
    cliente_nombre: 'María López',
    telefono: '987654321',
    ciudad: 'Lima',
    presentacion: 'Pote 50 g',
    cantidad: 1,
    precio_unitario: 25,
    tipo_precio: 'menudeo',
    entrega: 'Recojo en Lima',
    total_estimado: 25,
    observaciones: null,
    estado: 'confirmado',
    notas_internas: null,
    ...over,
  };
}

describe('customerKey', () => {
  it('reconoce el mismo celular escrito de varias formas', () => {
    expect(customerKey('987 654 321')).toBe('987654321');
    expect(customerKey('+51 987-654-321')).toBe('987654321');
    expect(customerKey('51987654321')).toBe('987654321');
    expect(customerKey('+34 612 345 678')).toBe('34612345678');
  });
});

describe('summarizeCustomers', () => {
  it('agrupa por celular, suma solo ventas y usa el nombre y la ciudad más recientes', () => {
    const list = summarizeCustomers([
      order({
        creado_en: '2026-10-01T10:00:00Z',
        ciudad: 'Huaraz',
        cantidad: 2,
        total_estimado: 50,
      }),
      order({
        creado_en: '2026-10-05T10:00:00Z',
        telefono: '+51 987 654 321',
        cliente_nombre: 'María L.',
        cantidad: 6,
        total_estimado: 120,
        estado: 'entregado',
      }),
      order({
        creado_en: '2026-10-06T10:00:00Z',
        estado: 'nuevo',
        cantidad: 3,
        total_estimado: 75,
      }),
      order({ creado_en: '2026-10-07T10:00:00Z', estado: 'cancelado', total_estimado: 25 }),
      order({
        creado_en: '2026-10-03T10:00:00Z',
        telefono: '911222333',
        cliente_nombre: 'José Pérez',
        ciudad: 'Arequipa',
        estado: 'cancelado',
      }),
    ]);
    expect(list).toHaveLength(2);
    const [maria, jose] = list;
    expect(maria).toMatchObject({
      telefono: '987654321',
      nombre: 'María López',
      ciudad: 'Lima',
      pedidos: 3,
      potes: 8,
      soles: 170,
      primer_pedido: '2026-10-01T10:00:00Z',
      ultimo_pedido: '2026-10-07T10:00:00Z',
    });
    expect(jose).toMatchObject({ nombre: 'José Pérez', pedidos: 0, potes: 0, soles: 0 });
  });

  it('sin pedidos no hay clientes', () => {
    expect(summarizeCustomers([])).toEqual([]);
  });
});

describe('filterCustomers', () => {
  const list = summarizeCustomers([
    order({ cliente_nombre: 'José Pérez', telefono: '911222333', ciudad: 'Áncash' }),
    order({ cliente_nombre: 'Ana Ruiz', telefono: '987654321', ciudad: 'Lima' }),
  ]);
  it('busca por nombre o ciudad sin tildes ni mayúsculas, y por celular', () => {
    expect(filterCustomers(list, 'jose').map((c) => c.nombre)).toEqual(['José Pérez']);
    expect(filterCustomers(list, 'ANCASH').map((c) => c.nombre)).toEqual(['José Pérez']);
    expect(filterCustomers(list, '654 321').map((c) => c.nombre)).toEqual(['Ana Ruiz']);
    expect(filterCustomers(list, '  ')).toHaveLength(2);
    expect(filterCustomers(list, 'zzz')).toEqual([]);
  });
});

describe('customersToRows', () => {
  it('arma la hoja de Excel con encabezados y fechas en hora de Lima', () => {
    const rows = customersToRows(
      summarizeCustomers([order({ creado_en: '2026-10-06T15:30:00Z' })]),
    );
    expect(rows[0]).toEqual(CUSTOMER_COLUMNS.map((c) => c.title));
    expect(rows[1]).toEqual([
      'María López',
      '987654321',
      'Lima',
      1,
      1,
      25,
      '2026-10-06 10:30',
      '2026-10-06 10:30',
      expect.stringMatching(/^P-\d{6}$/),
    ]);
  });
});
