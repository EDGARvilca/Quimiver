import { describe, expect, it } from 'vitest';
import {
  isPickup,
  isValidPhone,
  normalizeOrderCode,
  parseTrackingResponse,
  trackingMessage,
  trackingSteps,
} from '../src/lib/tracking';
import { ORDER_STATES } from '../src/lib/panel';

describe('seguimiento de pedidos', () => {
  it('acepta el número de pedido escrito de varias formas', () => {
    expect(normalizeOrderCode('P-000123')).toBe('P-000123');
    expect(normalizeOrderCode(' p-123 ')).toBe('P-000123');
    expect(normalizeOrderCode('p123')).toBe('P-000123');
    expect(normalizeOrderCode('123')).toBe('P-000123');
    expect(normalizeOrderCode('')).toBeNull();
    expect(normalizeOrderCode('LR-000001')).toBeNull();
    expect(normalizeOrderCode('P-1234567')).toBeNull();
  });

  it('valida el celular por cantidad de dígitos', () => {
    expect(isValidPhone('987 654 321')).toBe(true);
    expect(isValidPhone('+51 987-654-321')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('marca los pasos hechos, el actual y los pendientes', () => {
    const steps = trackingSteps({ estado: 'pagado', entrega: 'Envío por Olva' });
    expect(steps.map((s) => `${s.label}:${s.status}`)).toEqual([
      'Recibido:hecho',
      'Confirmado:hecho',
      'Pagado:actual',
      'Enviado:pendiente',
      'Entregado:pendiente',
    ]);
    expect(trackingSteps({ estado: 'cancelado', entrega: '' })).toEqual([]);
  });

  it('usa "Listo para recoger" en los recojos', () => {
    expect(isPickup('Recojo en Lima (costo según zona)')).toBe(true);
    expect(isPickup('Envío por Shalom')).toBe(false);
    const steps = trackingSteps({ estado: 'enviado', entrega: 'Recojo en Lima' });
    expect(steps[3]).toEqual({ state: 'enviado', label: 'Listo para recoger', status: 'actual' });
  });

  it('tiene un mensaje para cada estado', () => {
    for (const estado of ORDER_STATES) {
      expect(trackingMessage({ estado, entrega: 'Envío por Olva' }).length).toBeGreaterThan(10);
    }
  });

  it('interpreta la respuesta del servidor sin confiar en ella', () => {
    expect(parseTrackingResponse(null)).toEqual({ ok: false, error: 'conexion' });
    expect(parseTrackingResponse({ ok: false, error: 'limite' })).toEqual({
      ok: false,
      error: 'limite',
    });
    expect(parseTrackingResponse({ ok: false, error: 'raro' })).toEqual({
      ok: false,
      error: 'conexion',
    });
    const ok = parseTrackingResponse({
      ok: true,
      codigo: 'P-000001',
      estado: 'nuevo',
      creado_en: '2026-10-06T15:30:00Z',
      presentacion: 'Frasco de 50 g',
      cantidad: 1,
      entrega: 'Recojo en Lima',
      total_estimado: '25.00',
    });
    expect(ok).toMatchObject({ ok: true, order: { codigo: 'P-000001', total_estimado: 25 } });
  });
});
