import {
  PRODUCT_ROW_ID,
  checkProductFields,
  describeProductChange,
  parseProductRow,
  type ProductFields,
  type ProductRow,
} from '../lib/product-data';
import { formatOrderDate } from '../lib/panel';

type Api = (path: string, init?: RequestInit) => Promise<Response>;

interface Change {
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  creado_por: string | null;
  creado_en: string;
}

/**
 * Sección "Producto y precios" del panel: lee y guarda la fila de `producto_web`.
 * La base revisa los permisos y los límites; aquí se revisan antes para avisar campo por campo.
 * Devuelve la función que la carga después de iniciar sesión.
 */
export function initProduct(api: Api): () => Promise<void> {
  const form = document.getElementById('panel-product-form');
  const status = document.getElementById('panel-product-status');
  const changes = document.getElementById('panel-product-changes');
  if (!(form instanceof HTMLFormElement) || !status || !changes) return async () => undefined;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  let saved: ProductRow | null = null;

  const say = (kind: 'success' | 'error', text: string) => {
    status.dataset.kind = kind;
    status.textContent = text;
    status.hidden = false;
  };

  const clearErrors = () => {
    form.querySelectorAll('.field-error').forEach((node) => node.remove());
    form.querySelectorAll('[aria-invalid]').forEach((node) => {
      node.removeAttribute('aria-invalid');
      node.removeAttribute('aria-describedby');
    });
  };

  const showErrors = (errors: Partial<Record<keyof ProductFields, string>>) => {
    let first: HTMLElement | null = null;
    for (const [name, message] of Object.entries(errors)) {
      const field = form.querySelector<HTMLElement>(`[name="${name}"]`);
      if (!field) continue;
      const error = document.createElement('p');
      error.className = 'field-error';
      error.id = `${field.id}-error`;
      error.textContent = message;
      field.closest('.form-field')?.append(error);
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', error.id);
      first ??= field;
    }
    first?.focus();
  };

  const fill = (row: ProductRow) => {
    const set = (name: keyof ProductFields, value: string) => {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.value = value;
      }
    };
    set('presentacion', row.presentacion);
    set('precio', row.precio.toFixed(2));
    set('precio_mayor', row.precio_mayor.toFixed(2));
    set('minimo_mayor', String(row.minimo_mayor));
    set('descripcion_corta', row.descripcion_corta);
    set('descripcion_google', row.descripcion_google);
  };

  const renderChanges = (list: Change[]) => {
    changes.replaceChildren(
      ...(list.length === 0
        ? [Object.assign(document.createElement('li'), { textContent: 'Sin cambios todavía.' })]
        : list.map((c) => {
            const item = document.createElement('li');
            const lines = describeProductChange(c.antes, c.despues).join('; ');
            item.textContent = `${formatOrderDate(c.creado_en)}: ${lines}${c.creado_por ? ` (${c.creado_por})` : ''}`;
            return item;
          })),
    );
  };

  const loadChanges = async () => {
    const res = await api(
      `producto_web_cambios?producto=eq.${PRODUCT_ROW_ID}&select=antes,despues,creado_por,creado_en&order=creado_en.desc&limit=10`,
    );
    if (res.ok) renderChanges((await res.json()) as Change[]);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    status.hidden = true;
    const checked = checkProductFields(Object.fromEntries(new FormData(form)));
    if (!checked.ok) {
      showErrors(checked.errors);
      say('error', 'Revisa los campos marcados.');
      return;
    }
    if (submit) submit.disabled = true;
    try {
      const res = await api(`producto_web?producto=eq.${PRODUCT_ROW_ID}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(checked.data),
      });
      const body: unknown = res.ok ? await res.json() : null;
      const row = parseProductRow(body);
      if (!res.ok || !row) {
        say(
          'error',
          res.status === 401 || res.status === 403 || (res.ok && !row)
            ? 'Tu cuenta no puede cambiar el producto. Vuelve a entrar.'
            : 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.',
        );
        return;
      }
      const changed = saved?.actualizado_en !== row.actualizado_en;
      saved = row;
      fill(row);
      say(
        'success',
        changed
          ? 'Guardado. La web mostrará los cambios cuando se vuelva a publicar.'
          : 'No había nada que cambiar.',
      );
      await loadChanges();
    } catch (error) {
      if (error instanceof Error && error.message === 'sesion') throw error;
      say('error', 'No se pudo guardar. Revisa tu conexión.');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  // Si falla, el resto del panel (pedidos, stock) sigue funcionando.
  return async () => {
    try {
      const res = await api(`producto_web?producto=eq.${PRODUCT_ROW_ID}&select=*`);
      const row = res.ok ? parseProductRow(await res.json()) : null;
      if (!row) throw new Error(String(res.status));
      saved = row;
      fill(row);
      if (submit) submit.disabled = false;
      await loadChanges();
    } catch (error) {
      if (error instanceof Error && error.message === 'sesion') throw error;
      say('error', 'No se pudieron cargar los datos del producto.');
    }
  };
}
