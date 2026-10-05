/**
 * Lógica pura del formulario de pedido (sin DOM), para poder probarla.
 *
 * El total es solo una estimación para el cliente: el precio final y el
 * costo de envío se confirman por WhatsApp. No existe backend que registre
 * el pedido.
 */

export interface Presentation {
  id: string;
  label: string;
  /** Precio por unidad al menudeo, en soles. */
  price: number;
  /** Precio por unidad desde `wholesaleMinQuantity` unidades, en soles. */
  wholesalePrice: number;
}

export interface ShippingOption {
  id: string;
  label: string;
  /** Costo en soles, o `null` si depende del destino y se coordina por WhatsApp. */
  fee: number | null;
}

export interface OrderConfig {
  productName: string;
  presentations: Presentation[];
  wholesaleMinQuantity: number;
  shippingOptions: ShippingOption[];
  paymentMethods: string;
  paymentNumber: string;
}

export interface OrderInput {
  customerName: string;
  phone: string;
  city: string;
  presentationId: string;
  quantity: number;
  shippingId: string;
  notes: string;
}

export type PriceType = 'menudeo' | 'por mayor';

export interface OrderQuote {
  unitPrice: number;
  priceType: PriceType;
  subtotal: number;
  /** `null` mientras no se elija entrega o si el costo se coordina después. */
  shippingFee: number | null;
  /** `true` si la entrega elegida tiene un costo que aún no se conoce. */
  shippingPending: boolean;
  total: number;
}

const EMPTY_QUOTE: OrderQuote = {
  unitPrice: 0,
  priceType: 'menudeo',
  subtotal: 0,
  shippingFee: null,
  shippingPending: false,
  total: 0,
};

export function formatCurrency(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

/** Devuelve importes en 0 si falta la presentación o la cantidad no es válida. */
export function quoteOrder(
  config: Pick<OrderConfig, 'presentations' | 'shippingOptions' | 'wholesaleMinQuantity'>,
  input: Pick<OrderInput, 'presentationId' | 'quantity' | 'shippingId'>,
): OrderQuote {
  const presentation = config.presentations.find((p) => p.id === input.presentationId);
  const quantity = Number.isFinite(input.quantity) ? Math.trunc(input.quantity) : 0;

  if (!presentation || quantity <= 0) {
    return EMPTY_QUOTE;
  }

  const isWholesale = quantity >= config.wholesaleMinQuantity;
  const unitPrice = isWholesale ? presentation.wholesalePrice : presentation.price;
  const subtotal = unitPrice * quantity;
  const shipping = config.shippingOptions.find((s) => s.id === input.shippingId);
  const shippingFee = shipping?.fee ?? null;

  return {
    unitPrice,
    priceType: isWholesale ? 'por mayor' : 'menudeo',
    subtotal,
    shippingFee,
    shippingPending: shipping !== undefined && shipping.fee === null,
    total: subtotal + (shippingFee ?? 0),
  };
}

export function buildOrderMessage(config: OrderConfig, input: OrderInput): string {
  const presentation = config.presentations.find((p) => p.id === input.presentationId);
  const shipping = config.shippingOptions.find((s) => s.id === input.shippingId);
  const quote = quoteOrder(config, input);
  const notes = input.notes.trim();

  const shippingCost = quote.shippingPending
    ? 'a coordinar según destino'
    : formatCurrency(quote.shippingFee ?? 0);

  const lines = [
    `*¡Hola! Quiero hacer un pedido de ${config.productName}:*`,
    `*Cliente:* ${input.customerName.trim()}`,
    `*Celular:* ${input.phone.trim()}`,
    `*Ciudad:* ${input.city.trim()}`,
    `*Presentación:* ${presentation?.label ?? input.presentationId}`,
    `*Cantidad:* ${input.quantity}`,
    `*Precio unitario:* ${formatCurrency(quote.unitPrice)} (${quote.priceType})`,
    `*Subtotal:* ${formatCurrency(quote.subtotal)}`,
    `*Entrega:* ${shipping?.label ?? input.shippingId}`,
    `*Costo de envío:* ${shippingCost}`,
    `*Total estimado:* ${formatCurrency(quote.total)}${quote.shippingPending ? ' + envío' : ''}`,
  ];

  if (notes) {
    lines.push(`*Observaciones:* ${notes}`);
  }

  lines.push(
    '',
    '*Métodos de pago:*',
    `${config.paymentMethods}: *${config.paymentNumber}*`,
    '',
    `Por favor envíe el comprobante de pago para procesar su pedido. ¡Gracias por confiar en *${config.productName}*!`,
  );

  return lines.join('\n');
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
