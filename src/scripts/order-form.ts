import {
  buildOrderMessage,
  buildWhatsAppUrl,
  formatCurrency,
  quoteOrder,
  type OrderConfig,
  type OrderInput,
} from '../lib/order';
import { pages } from '../config/pages';
import { site } from '../config/site';

/** Tiempo máximo que esperamos al registro antes de abrir WhatsApp igual. */
const REGISTER_TIMEOUT_MS = 4000;

/**
 * Guarda una copia numerada del pedido. Nunca bloquea la venta: si el registro falla o
 * tarda, devuelve `undefined` y el pedido sigue por WhatsApp sin número.
 */
async function registerOrder(
  config: OrderConfig,
  input: OrderInput,
  honeypot: string,
): Promise<string | undefined> {
  const quote = quoteOrder(config, input);
  const presentation = config.presentations.find((p) => p.id === input.presentationId);
  const shipping = config.shippingOptions.find((s) => s.id === input.shippingId);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);
  try {
    const res = await fetch(site.orders.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        cliente_nombre: input.customerName,
        telefono: input.phone,
        ciudad: input.city,
        presentacion: presentation?.label ?? input.presentationId,
        cantidad: input.quantity,
        precio_unitario: quote.unitPrice,
        tipo_precio: quote.priceType,
        entrega: shipping?.label ?? input.shippingId,
        total_estimado: quote.total,
        observaciones: input.notes,
        sitio_web: honeypot,
      }),
    });
    if (res.status !== 201) return undefined;
    const data = (await res.json()) as { codigo?: unknown };
    return typeof data.codigo === 'string' ? data.codigo : undefined;
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Pregunta al servidor si hay stock (sin la cantidad) y muestra el aviso de agotado.
 * Si no responde, no muestra nada: el pedido sigue funcionando igual.
 */
async function showStock(notice: HTMLElement): Promise<void> {
  try {
    const res = await fetch(site.orders.endpoint, {
      signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
    });
    const data = (await res.json()) as { disponible?: unknown };
    notice.hidden = data.disponible !== false;
  } catch {
    // Sin respuesta: no se sabe; mejor no alarmar.
  }
}

function readConfig(): OrderConfig | null {
  const node = document.getElementById('order-config');
  if (!node?.textContent) {
    return null;
  }
  return JSON.parse(node.textContent) as OrderConfig;
}

function readInput(form: HTMLFormElement): OrderInput {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? '');
  return {
    customerName: text('customer-name'),
    phone: text('phone'),
    city: text('city'),
    presentationId: text('presentation'),
    quantity: Number(text('quantity')) || 0,
    shippingId: text('delivery'),
    notes: text('notes'),
  };
}

function showStatus(node: HTMLElement, kind: 'success' | 'error', content: Node | string): void {
  node.replaceChildren(content);
  node.dataset.kind = kind;
  node.hidden = false;
}

export function initOrderForm(): void {
  const form = document.getElementById('order-form');
  const totalLabel = document.getElementById('order-total');
  const status = document.getElementById('order-status');
  const config = readConfig();

  if (!(form instanceof HTMLFormElement) || !totalLabel || !status || !config) {
    return;
  }

  const refreshTotal = () => {
    const quote = quoteOrder(config, readInput(form));
    const pending = quote.shippingPending ? ' + envío' : '';
    const detail = quote.subtotal > 0 ? ` (precio ${quote.priceType})` : '';
    totalLabel.textContent = `${formatCurrency(quote.total)}${pending}${detail}`;
  };

  form.addEventListener('input', refreshTotal);
  form.addEventListener('change', refreshTotal);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;

    if (!form.reportValidity()) {
      return;
    }

    const input = readInput(form);
    const honeypot = String(new FormData(form).get('sitio_web') ?? '');
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    // La ventana se abre ya, dentro del clic, para que el navegador no la bloquee;
    // recibe la dirección de WhatsApp cuando el pedido queda registrado.
    // Sin "noopener" para poder detectar el bloqueo (con él window.open siempre devuelve null).
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.opener = null;
      newWindow.document.title = 'Abriendo WhatsApp…';
      newWindow.document.body.textContent = 'Abriendo WhatsApp con tu pedido…';
    }
    if (submit) submit.disabled = true;

    const code = await registerOrder(config, input, honeypot);
    const url = buildWhatsAppUrl(site.contact.whatsapp, buildOrderMessage(config, input, code));
    if (submit) submit.disabled = false;

    if (!newWindow || newWindow.closed) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Abrir WhatsApp con mi pedido';
      const wrapper = document.createElement('span');
      wrapper.append(
        code
          ? `Registramos tu pedido ${code}. Si WhatsApp no se abrió, tu navegador pudo bloquear la ventana. `
          : 'Si WhatsApp no se abrió, tu navegador pudo bloquear la ventana. Tus datos siguen en el formulario. ',
        link,
      );
      showStatus(status, 'error', wrapper);
      return;
    }

    newWindow.location.href = url;
    form.reset();
    refreshTotal();
    if (code) {
      const track = document.createElement('a');
      track.className = 'text-link';
      track.href = `${pages.tracking}?pedido=${encodeURIComponent(code)}`;
      track.textContent = 'Sigue tu pedido aquí';
      const wrapper = document.createElement('span');
      wrapper.append(
        `Registramos tu pedido ${code} y abrimos WhatsApp. Envía el mensaje para confirmarlo. `,
        track,
        '.',
      );
      showStatus(status, 'success', wrapper);
    } else {
      showStatus(
        status,
        'success',
        'Abrimos WhatsApp con tu pedido. Envía el mensaje para confirmarlo.',
      );
    }
  });

  refreshTotal();

  const stockNotice = document.getElementById('order-stock');
  if (stockNotice) void showStock(stockNotice);
}
