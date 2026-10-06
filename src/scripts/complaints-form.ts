import { validateComplaint } from '../../supabase/functions/libro-reclamaciones/complaint';

interface Config {
  endpoint: string;
  email: string;
}

interface Receipt {
  codigo: string;
  hoja: [string, string][];
  correoEnviado: boolean;
}

function readConfig(): Config | null {
  const node = document.getElementById('complaints-config');
  return node?.textContent ? (JSON.parse(node.textContent) as Config) : null;
}

function readForm(form: HTMLFormElement): Record<string, unknown> {
  const data = new FormData(form);
  const out: Record<string, unknown> = {};
  data.forEach((value, key) => {
    out[key] = String(value);
  });
  out.menor_de_edad = data.has('menor_de_edad');
  return out;
}

function clearErrors(form: HTMLFormElement): void {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function showErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  let first: HTMLElement | null = null;
  for (const [name, message] of Object.entries(errors)) {
    const field = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (!field) continue;
    const id = `${name}-error`;
    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = id;
    error.textContent = message;
    field.closest('.form-field')?.append(error);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', id);
    first ??= field;
  }
  first?.focus();
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

function setStatus(node: HTMLElement, kind: 'error' | 'success', html: string): void {
  node.hidden = false;
  node.dataset.kind = kind;
  node.innerHTML = html;
}

function renderReceipt(receipt: Receipt, email: string): void {
  const box = document.getElementById('complaints-receipt');
  const rows = document.getElementById('complaints-receipt-rows');
  const note = document.getElementById('complaints-receipt-note');
  if (!box || !rows || !note) return;
  rows.replaceChildren(
    ...receipt.hoja.map(([label, value]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      const td = document.createElement('td');
      th.scope = 'row';
      th.textContent = label;
      td.textContent = value;
      tr.append(th, td);
      return tr;
    }),
  );
  note.textContent = receipt.correoEnviado
    ? `Tu hoja ${receipt.codigo} quedó registrada y te enviamos una copia por correo. Guárdala o imprímela.`
    : `Tu hoja ${receipt.codigo} quedó registrada. No pudimos enviar la copia por correo: imprímela o guárdala en PDF, y si necesitas ayuda escríbenos a ${email}.`;
  box.hidden = false;
  box.focus();
}

export function initComplaintsForm(): void {
  const form = document.getElementById('complaints-form') as HTMLFormElement | null;
  const status = document.getElementById('complaints-status');
  const config = readConfig();
  if (!form || !status || !config) return;

  const minor = form.querySelector<HTMLInputElement>('#menor_de_edad');
  const guardian = document.getElementById('apoderado-field');
  minor?.addEventListener('change', () => {
    if (guardian) guardian.hidden = !minor.checked;
  });

  document.getElementById('complaints-print')?.addEventListener('click', () => window.print());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    status.hidden = true;

    const data = readForm(form);
    const result = validateComplaint(data);
    const consent = form.querySelector<HTMLInputElement>('#complaints-consent');
    const errors = result.ok ? {} : { ...result.errors };
    if (!consent?.checked) errors.consent = 'Necesitamos tu autorización para atender la hoja.';
    if (Object.keys(errors).length > 0) {
      setStatus(status, 'error', 'Revisa los campos marcados.');
      showErrors(form, errors);
      return;
    }

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando…';
    }
    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Receipt> & {
        error?: string;
        errors?: Record<string, string>;
      };
      if (res.status === 201 && body.codigo && body.hoja) {
        form.hidden = true;
        renderReceipt(body as Receipt, config.email);
        return;
      }
      const message = escapeHtml(body.error ?? 'No se pudo registrar la hoja.');
      setStatus(
        status,
        'error',
        `${message} Si el problema sigue, escríbenos a <a href="mailto:${config.email}">${config.email}</a>.`,
      );
      if (body.errors) showErrors(form, body.errors);
    } catch {
      setStatus(
        status,
        'error',
        `No hay conexión con el libro en este momento. Intenta de nuevo o escríbenos a <a href="mailto:${config.email}">${config.email}</a>.`,
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Enviar hoja de reclamación';
      }
    }
  });
}
