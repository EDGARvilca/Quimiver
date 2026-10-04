/**
 * Lógica pura del formulario de pedido (sin DOM), para poder probarla.
 *
 * El total es solo una estimación para el cliente: el precio final se
 * confirma por WhatsApp. No existe backend que registre el pedido.
 */

export interface Presentation {
  id: string;
  label: string;
  price: number;
}

export interface ShippingOption {
  id: string;
  label: string;
  fee: number;
}

export interface OrderConfig {
  productName: string;
  presentations: Presentation[];
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

export function formatCurrency(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

/** Devuelve 0 si falta la presentación o la cantidad no es válida. */
export function calculateTotal(
  config: Pick<OrderConfig, 'presentations' | 'shippingOptions'>,
  input: Pick<OrderInput, 'presentationId' | 'quantity' | 'shippingId'>,
): number {
  const presentation = config.presentations.find((p) => p.id === input.presentationId);
  const quantity = Number.isFinite(input.quantity) ? Math.trunc(input.quantity) : 0;

  if (!presentation || quantity <= 0) {
    return 0;
  }

  const shipping = config.shippingOptions.find((s) => s.id === input.shippingId);
  return presentation.price * quantity + (shipping?.fee ?? 0);
}

export function buildOrderMessage(config: OrderConfig, input: OrderInput): string {
  const presentation = config.presentations.find((p) => p.id === input.presentationId);
  const total = calculateTotal(config, input);
  const notes = input.notes.trim();

  const lines = [
    `*¡Hola! Quiero hacer un pedido de ${config.productName}:*`,
    `*Cliente:* ${input.customerName.trim()}`,
    `*Celular:* ${input.phone.trim()}`,
    `*Ciudad:* ${input.city.trim()}`,
    `*Presentación:* ${presentation?.label ?? input.presentationId}`,
    `*Cantidad:* ${input.quantity}`,
    `*Entrega:* ${input.shippingId}`,
    `*Total estimado:* ${formatCurrency(total)}`,
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
