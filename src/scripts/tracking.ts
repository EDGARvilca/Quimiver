import { site } from '../config/site';
import { formatCurrency } from '../lib/order';
import { formatOrderDate } from '../lib/panel';
import {
  TRACKING_ERRORS,
  isValidPhone,
  normalizeOrderCode,
  parseTrackingResponse,
  trackingMessage,
  trackingSteps,
  type TrackedOrder,
  type TrackingResult,
} from '../lib/tracking';

/**
 * Página "Sigue tu pedido". Llama a la función `seguir_pedido` de Supabase con la clave
 * publicable; la base solo responde si el número y el celular coinciden.
 */

const { supabaseUrl, publishableKey } = site.panel;

async function lookup(codigo: string, telefono: string): Promise<TrackingResult> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/seguir_pedido`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_codigo: codigo, p_telefono: telefono }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: 'conexion' };
    return parseTrackingResponse(await res.json());
  } catch {
    return { ok: false, error: 'conexion' };
  }
}

function detail(term: string, value: string): HTMLElement[] {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

export function initTracking(): void {
  const form = document.getElementById('tracking-form');
  const status = document.getElementById('tracking-status');
  const result = document.getElementById('tracking-result');
  const code = document.getElementById('tracking-result-code');
  const title = document.getElementById('tracking-result-title');
  const message = document.getElementById('tracking-result-message');
  const steps = document.getElementById('tracking-steps');
  const details = document.getElementById('tracking-details');
  if (
    !(form instanceof HTMLFormElement) ||
    !status ||
    !result ||
    !code ||
    !title ||
    !message ||
    !steps ||
    !details
  ) {
    return;
  }

  const codeInput = form.elements.namedItem('codigo');
  const phoneInput = form.elements.namedItem('telefono');
  if (!(codeInput instanceof HTMLInputElement) || !(phoneInput instanceof HTMLInputElement)) return;

  // Enlace directo: /seguimiento/?pedido=P-000123 deja el número escrito.
  const fromUrl = normalizeOrderCode(new URLSearchParams(location.search).get('pedido') ?? '');
  if (fromUrl) codeInput.value = fromUrl;

  const showError = (text: string) => {
    status.textContent = text;
    status.dataset.kind = 'error';
    status.hidden = false;
  };

  const show = (order: TrackedOrder) => {
    const cancelled = order.estado === 'cancelado';
    code.textContent = `Pedido ${order.codigo}`;
    const current = trackingSteps(order).find((s) => s.status === 'actual');
    title.textContent = cancelled ? 'Cancelado' : (current?.label ?? '');
    message.textContent = trackingMessage(order);
    result.dataset.estado = order.estado;
    steps.replaceChildren(
      ...trackingSteps(order).map((s) => {
        const li = document.createElement('li');
        li.dataset.status = s.status;
        li.textContent = s.label;
        if (s.status === 'actual') li.setAttribute('aria-current', 'step');
        return li;
      }),
    );
    steps.hidden = cancelled;
    details.replaceChildren(
      ...detail('Fecha', formatOrderDate(order.creado_en)),
      ...detail('Producto', `${order.cantidad} × ${order.presentacion}`),
      ...detail('Entrega', order.entrega),
      ...detail('Total estimado', formatCurrency(order.total_estimado)),
    );
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    const codigo = normalizeOrderCode(codeInput.value);
    if (!codigo || !isValidPhone(phoneInput.value)) {
      result.hidden = true;
      showError(TRACKING_ERRORS.datos);
      return;
    }
    codeInput.value = codigo;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    const found = await lookup(codigo, phoneInput.value);
    if (submit) submit.disabled = false;
    if (found.ok) show(found.order);
    else {
      result.hidden = true;
      showError(TRACKING_ERRORS[found.error]);
    }
  });
}
