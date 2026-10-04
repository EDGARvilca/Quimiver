import { describe, expect, it } from 'vitest';
import {
  buildOrderMessage,
  buildWhatsAppUrl,
  formatCurrency,
  quoteOrder,
  type OrderConfig,
  type OrderInput,
} from '../src/lib/order';

const config: OrderConfig = {
  productName: 'QUIMIVER',
  presentations: [{ id: '50g', label: 'Frasco de 50 g', price: 25, wholesalePrice: 20 }],
  wholesaleMinQuantity: 6,
  shippingOptions: [
    { id: 'recojo-lima', label: 'Recojo en Lima (sin costo)', fee: 0 },
    { id: 'shalom', label: 'Envío por Shalom (costo según destino)', fee: null },
    { id: 'olva', label: 'Envío por Olva (costo según destino)', fee: null },
  ],
  paymentMethods: 'Yape / Plin',
  paymentNumber: '929445834',
};

const input: OrderInput = {
  customerName: ' Ana Torres ',
  phone: '999 888 777',
  city: 'Huaraz',
  presentationId: '50g',
  quantity: 2,
  shippingId: 'recojo-lima',
  notes: '',
};

describe('formatCurrency', () => {
  it('usa el formato de soles con dos decimales', () => {
    expect(formatCurrency(25)).toBe('S/ 25.00');
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });
});

describe('quoteOrder', () => {
  it('aplica el precio de menudeo por debajo del mínimo por mayor', () => {
    const quote = quoteOrder(config, { ...input, quantity: 5 });
    expect(quote).toMatchObject({ unitPrice: 25, priceType: 'menudeo', subtotal: 125, total: 125 });
  });

  it('aplica el precio por mayor desde media docena', () => {
    const quote = quoteOrder(config, { ...input, quantity: 6 });
    expect(quote).toMatchObject({ unitPrice: 20, priceType: 'por mayor', subtotal: 120 });
  });

  it('aplica el precio por mayor a una docena', () => {
    expect(quoteOrder(config, { ...input, quantity: 12 }).subtotal).toBe(240);
  });

  it('suma el envío cuando tiene costo fijo', () => {
    const quote = quoteOrder(config, input);
    expect(quote.shippingFee).toBe(0);
    expect(quote.shippingPending).toBe(false);
    expect(quote.total).toBe(50);
  });

  it('marca el envío como pendiente cuando depende del destino', () => {
    const quote = quoteOrder(config, { ...input, shippingId: 'olva' });
    expect(quote.shippingFee).toBeNull();
    expect(quote.shippingPending).toBe(true);
    expect(quote.total).toBe(50);
  });

  it('no marca envío pendiente si aún no se eligió entrega', () => {
    const quote = quoteOrder(config, { ...input, shippingId: '' });
    expect(quote.shippingPending).toBe(false);
    expect(quote.total).toBe(50);
  });

  it('devuelve 0 sin presentación o con presentación inexistente', () => {
    expect(quoteOrder(config, { ...input, presentationId: '' }).total).toBe(0);
    expect(quoteOrder(config, { ...input, presentationId: '100' }).total).toBe(0);
  });

  it('devuelve 0 con cantidad cero, negativa o inválida', () => {
    expect(quoteOrder(config, { ...input, quantity: 0 }).total).toBe(0);
    expect(quoteOrder(config, { ...input, quantity: -3 }).total).toBe(0);
    expect(quoteOrder(config, { ...input, quantity: Number.NaN }).total).toBe(0);
  });
});

describe('buildOrderMessage', () => {
  it('incluye los datos del pedido, el tipo de precio y el total', () => {
    const message = buildOrderMessage(config, { ...input, quantity: 6 });
    expect(message).toContain('*Cliente:* Ana Torres');
    expect(message).toContain('*Presentación:* Frasco de 50 g');
    expect(message).toContain('*Precio unitario:* S/ 20.00 (por mayor)');
    expect(message).toContain('*Subtotal:* S/ 120.00');
    expect(message).toContain('*Entrega:* Recojo en Lima (sin costo)');
    expect(message).toContain('*Costo de envío:* S/ 0.00');
    expect(message).toContain('*Total estimado:* S/ 120.00');
    expect(message).toContain('Yape / Plin: *929445834*');
  });

  it('indica que el envío se coordina cuando depende del destino', () => {
    const message = buildOrderMessage(config, { ...input, shippingId: 'shalom' });
    expect(message).toContain('*Costo de envío:* a coordinar según destino');
    expect(message).toContain('*Total estimado:* S/ 50.00 + envío');
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
