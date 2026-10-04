import {
  buildOrderMessage,
  buildWhatsAppUrl,
  calculateTotal,
  formatCurrency,
  type OrderConfig,
  type OrderInput,
} from '../lib/order';
import { site } from '../config/site';

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
    totalLabel.textContent = formatCurrency(calculateTotal(config, readInput(form)));
  };

  form.addEventListener('input', refreshTotal);
  form.addEventListener('change', refreshTotal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.hidden = true;

    if (!form.reportValidity()) {
      return;
    }

    const message = buildOrderMessage(config, readInput(form));
    const url = buildWhatsAppUrl(site.contact.whatsapp, message);
    // Sin la opción "noopener" para poder detectar si el navegador bloqueó la ventana
    // (con ella window.open siempre devuelve null). Se corta la referencia después.
    const newWindow = window.open(url, '_blank');

    if (!newWindow) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Abrir WhatsApp con mi pedido';
      const wrapper = document.createElement('span');
      wrapper.append(
        'Si WhatsApp no se abrió, tu navegador pudo bloquear la ventana. Tus datos siguen en el formulario. ',
        link,
      );
      showStatus(status, 'error', wrapper);
      return;
    }

    newWindow.opener = null;
    form.reset();
    refreshTotal();
    showStatus(
      status,
      'success',
      'Abrimos WhatsApp con tu pedido. Envía el mensaje para confirmarlo.',
    );
  });

  refreshTotal();
}
