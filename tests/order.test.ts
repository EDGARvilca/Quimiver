import { describe, expect, it } from 'vitest';
import {
  buildOrderMessage,
  buildWhatsAppUrl,
  calculateTotal,
  formatCurrency,
  type OrderConfig,
  type OrderInput,
} from '../src/lib/order';

const config: OrderConfig = {
  productName: 'QUIMIVER',
  presentations: [
    { id: '50', label: '50 ml', price: 45 },
    { id: '100', label: '100 ml', price: 75 },
  ],
  shippingOptions: [
    { id: 'Recojo en Lima', label: 'Recojo en Lima (sin costo)', fee: 0 },
    { id: 'Envio Lima', label: 'Envío Lima Metropolitana (+S/ 10)', fee: 10 },
    { id: 'Envio provincias', label: 'Envío a provincias (+S/ 15)', fee: 15 },
  ],
  paymentMethods: 'Yape / Plin',
  paymentNumber: '929445834',
};

const input: OrderInput = {
  customerName: ' Ana Torres ',
  phone: '999 888 777',
  city: 'Huaraz',
  presentationId: '100',
  quantity: 2,
  shippingId: 'Envio provincias',
  notes: '',
};

describe('formatCurrency', () => {
  it('usa el formato de soles con dos decimales', () => {
    expect(formatCurrency(45)).toBe('S/ 45.00');
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });
});

describe('calculateTotal', () => {
  it('suma precio por cantidad más envío', () => {
    expect(calculateTotal(config, input)).toBe(165);
  });

  it('no suma envío si aún no se eligió', () => {
    expect(calculateTotal(config, { ...input, shippingId: '' })).toBe(150);
  });

  it('devuelve 0 sin presentación', () => {
    expect(calculateTotal(config, { ...input, presentationId: '' })).toBe(0);
  });

  it('devuelve 0 con presentación inexistente', () => {
    expect(calculateTotal(config, { ...input, presentationId: '999' })).toBe(0);
  });

  it('devuelve 0 con cantidad cero, negativa o inválida', () => {
    expect(calculateTotal(config, { ...input, quantity: 0 })).toBe(0);
    expect(calculateTotal(config, { ...input, quantity: -3 })).toBe(0);
    expect(calculateTotal(config, { ...input, quantity: Number.NaN })).toBe(0);
  });
});

describe('buildOrderMessage', () => {
  it('incluye los datos del pedido y el total', () => {
    const message = buildOrderMessage(config, input);
    expect(message).toContain('*Cliente:* Ana Torres');
    expect(message).toContain('*Presentación:* 100 ml');
    expect(message).toContain('*Entrega:* Envio provincias');
    expect(message).toContain('*Total estimado:* S/ 165.00');
    expect(message).toContain('Yape / Plin: *929445834*');
  });

  it('omite observaciones vacías', () => {
    expect(buildOrderMessage(config, { ...input, notes: '   ' })).not.toContain('Observaciones');
  });

  it('coloca las observaciones con los datos del pedido, antes del pago', () => {
    const message = buildOrderMessage(config, { ...input, notes: 'Entregar por la tarde' });
    const notesAt = message.indexOf('*Observaciones:* Entregar por la tarde');
    expect(notesAt).toBeGreaterThan(-1);
    expect(notesAt).toBeLessThan(message.indexOf('*Métodos de pago:*'));
  });

  it('no deja espacios sueltos al inicio de las líneas', () => {
    const lines = buildOrderMessage(config, input).split('\n');
    expect(lines.every((line) => !line.startsWith(' '))).toBe(true);
  });
});

describe('buildWhatsAppUrl', () => {
  it('codifica el mensaje en la URL de wa.me', () => {
    expect(buildWhatsAppUrl('51929445834', 'Hola & adiós\n')).toBe(
      'https://wa.me/51929445834?text=Hola%20%26%20adi%C3%B3s%0A',
    );
  });
});
