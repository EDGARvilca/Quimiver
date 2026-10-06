import { site } from '../config/site';
import { formatCurrency } from '../lib/order';
import {
  EXPORT_COLUMNS,
  ORDER_STATES,
  STATE_LABELS,
  countByState,
  customerWhatsApp,
  exportFileName,
  filterByState,
  formatOrderDate,
  isOrderState,
  isStockError,
  monthLabel,
  ordersToRows,
  parseStockAdjustment,
  plural,
  summarizeSales,
  stockLevel,
  type StockMove,
  type OrderState,
  type PanelOrder,
} from '../lib/panel';
import { buildXlsx } from '../lib/xlsx';

/**
 * Panel privado de pedidos. Inicia sesión con Supabase Auth (correo y contraseña) y lee o
 * actualiza la tabla `pedidos` por la API REST. Las reglas RLS de la base deciden el acceso:
 * este código no da permisos, solo muestra lo que la sesión puede ver.
 */

const { supabaseUrl, publishableKey } = site.panel;
const SESSION_KEY = 'quimiver-panel-sesion';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Sin almacenamiento: la sesión dura mientras la página esté abierta.
  }
}

async function authRequest(grant: 'password' | 'refresh_token', body: object): Promise<Session> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 400 ? 'credenciales' : 'red');
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

let session = loadSession();

async function validToken(): Promise<string> {
  if (!session) throw new Error('sesion');
  if (Date.now() > session.expires_at) {
    session = await authRequest('refresh_token', { refresh_token: session.refresh_token });
    saveSession(session);
  }
  return session.access_token;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await validToken();
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initPanel(): void {
  const loginForm = document.getElementById('panel-login');
  const loginStatus = document.getElementById('panel-login-status');
  const board = document.getElementById('panel-board');
  const filters = document.getElementById('panel-filters');
  const list = document.getElementById('panel-list');
  const boardStatus = document.getElementById('panel-status');
  const refresh = document.getElementById('panel-refresh');
  const download = document.getElementById('panel-download');
  const logout = document.getElementById('panel-logout');
  const stockCount = document.getElementById('panel-stock-count');
  const stockWarning = document.getElementById('panel-stock-warning');
  const stockForm = document.getElementById('panel-stock-form');
  const stockStatus = document.getElementById('panel-stock-status');
  const stockMoves = document.getElementById('panel-stock-moves');
  const salesCards = document.getElementById('panel-sales-cards');
  const salesMonths = document.getElementById('panel-sales-months');
  const salesCities = document.getElementById('panel-sales-cities');

  if (
    !(loginForm instanceof HTMLFormElement) ||
    !loginStatus ||
    !board ||
    !filters ||
    !list ||
    !boardStatus ||
    !refresh ||
    !(download instanceof HTMLButtonElement) ||
    !logout ||
    !stockCount ||
    !stockWarning ||
    !(stockForm instanceof HTMLFormElement) ||
    !stockStatus ||
    !stockMoves ||
    !salesCards ||
    !salesMonths ||
    !salesCities
  ) {
    return;
  }

  let orders: PanelOrder[] = [];
  let current: OrderState | 'todos' = 'todos';

  const say = (node: HTMLElement, kind: 'success' | 'error', text: string) => {
    node.textContent = text;
    node.dataset.kind = kind;
    node.hidden = false;
  };

  const showLogin = (message?: string) => {
    session = null;
    saveSession(null);
    board.hidden = true;
    loginForm.hidden = false;
    if (message) say(loginStatus, 'error', message);
    else loginStatus.hidden = true;
  };

  const renderStock = (stock: number, moves: StockMove[]) => {
    stockCount.textContent = String(stock);
    const level = stockLevel(stock);
    if (level === 'ok') stockWarning.hidden = true;
    else
      say(
        stockWarning,
        'error',
        level === 'agotado'
          ? 'Sin stock: la web muestra "Agotado". Registra los potes nuevos aquí.'
          : `Quedan pocos potes (${stock}).`,
      );
    stockMoves.replaceChildren(
      ...moves.map((m) =>
        el(
          'li',
          undefined,
          `${formatOrderDate(m.creado_en)} · ${m.cantidad > 0 ? '+' : ''}${m.cantidad} · ${m.motivo} · quedan ${m.stock_resultante}`,
        ),
      ),
    );
  };

  const loadStock = async () => {
    const res = await api('rpc/ver_stock', { method: 'POST', body: '{}' });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { stock: number; movimientos: StockMove[] };
    renderStock(data.stock, data.movimientos);
  };

  const renderSales = () => {
    const sales = summarizeSales(orders);
    const card = (title: string, t: { pedidos: number; potes: number; soles: number }) => {
      const box = el('div', 'panel-sales-card');
      box.append(
        el('span', 'panel-sales-label', title),
        el('strong', undefined, formatCurrency(t.soles)),
        el(
          'span',
          undefined,
          `${plural(t.potes, 'pote', 'potes')} · ${plural(t.pedidos, 'pedido', 'pedidos')}`,
        ),
      );
      return box;
    };
    salesCards.replaceChildren(
      card('Esta semana', sales.semana),
      card('Este mes', sales.mes),
      card('Desde el inicio', sales.total),
    );
    salesMonths.replaceChildren(
      ...sales.meses.map((m) => {
        const row = el('tr');
        row.append(
          el('th', undefined, monthLabel(m.mes)),
          el('td', undefined, String(m.pedidos)),
          el('td', undefined, String(m.potes)),
          el('td', undefined, formatCurrency(m.soles)),
        );
        row.firstElementChild?.setAttribute('scope', 'row');
        return row;
      }),
    );
    salesCities.replaceChildren(
      ...(sales.ciudades.length === 0
        ? [el('li', 'panel-empty-inline', 'Todavía no hay ventas confirmadas.')]
        : sales.ciudades.map((c) =>
            el(
              'li',
              undefined,
              `${c.ciudad}: ${plural(c.potes, 'pote', 'potes')} (${formatCurrency(c.soles)})`,
            ),
          )),
    );
  };

  const renderFilters = () => {
    const counts = countByState(orders);
    filters.replaceChildren(
      ...(['todos', ...ORDER_STATES] as const).map((state) => {
        const button = el(
          'button',
          'panel-filter',
          `${state === 'todos' ? 'Todos' : STATE_LABELS[state]} (${counts[state]})`,
        );
        button.type = 'button';
        button.setAttribute('aria-pressed', String(state === current));
        button.addEventListener('click', () => {
          current = state;
          render();
        });
        return button;
      }),
    );
  };

  const renderOrder = (order: PanelOrder): HTMLElement => {
    const card = el('li', 'panel-order');
    card.dataset.state = order.estado;

    const head = el('div', 'panel-order-head');
    head.append(
      el('strong', 'panel-code', order.codigo),
      el('span', 'panel-date', formatOrderDate(order.creado_en)),
      el('span', 'panel-badge', STATE_LABELS[order.estado]),
    );

    const facts = el('dl', 'panel-facts');
    const fact = (term: string, value: string | Node) => {
      const row = el('div');
      const dd = el('dd');
      dd.append(value);
      row.append(el('dt', undefined, term), dd);
      facts.append(row);
    };
    fact('Cliente', order.cliente_nombre);
    const phone = el('a', 'text-link', order.telefono);
    phone.href = customerWhatsApp(order.telefono, order.codigo);
    phone.target = '_blank';
    phone.rel = 'noopener';
    fact('Celular', phone);
    fact('Ciudad', order.ciudad);
    fact('Pedido', `${order.presentacion} × ${order.cantidad} (${order.tipo_precio})`);
    fact('Entrega', order.entrega);
    fact('Total estimado', formatCurrency(Number(order.total_estimado)));
    if (order.observaciones) fact('Observaciones', order.observaciones);

    const form = el('form', 'panel-edit');
    const stateId = `estado-${order.id}`;
    const notesId = `notas-${order.id}`;
    const stateLabel = el('label', undefined, 'Estado');
    stateLabel.htmlFor = stateId;
    const select = el('select');
    select.id = stateId;
    for (const state of ORDER_STATES) {
      const option = el('option', undefined, STATE_LABELS[state]);
      option.value = state;
      option.selected = state === order.estado;
      select.append(option);
    }
    const notesLabel = el('label', undefined, 'Notas internas');
    notesLabel.htmlFor = notesId;
    const notes = el('textarea');
    notes.id = notesId;
    notes.rows = 2;
    notes.maxLength = 2000;
    notes.value = order.notas_internas ?? '';
    const save = el('button', 'btn primary', 'Guardar');
    save.type = 'submit';
    const status = el('p', 'form-status');
    status.hidden = true;
    status.setAttribute('role', 'status');

    form.append(stateLabel, select, notesLabel, notes, save, status);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const estado = select.value;
      if (!isOrderState(estado)) return;
      save.disabled = true;
      try {
        const res = await api(`pedidos?id=eq.${order.id}&select=*`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ estado, notas_internas: notes.value.trim() || null }),
        });
        const payload: unknown = await res.json().catch(() => null);
        if (!res.ok && isStockError(payload)) {
          say(status, 'error', 'No hay stock suficiente para este pedido. Registra potes arriba.');
          return;
        }
        const [updated] = res.ok ? (payload as PanelOrder[]) : [];
        if (!updated) throw new Error(String(res.status));
        orders = orders.map((o) => (o.id === updated.id ? updated : o));
        render();
        await loadStock().catch(() => undefined);
        say(
          boardStatus,
          'success',
          `Guardado: ${updated.codigo} quedó como ${STATE_LABELS[updated.estado]}.`,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'sesion') return showLogin();
        say(status, 'error', 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        save.disabled = false;
      }
    });

    card.append(head, facts, form);
    return card;
  };

  const render = () => {
    renderFilters();
    renderSales();
    const visible = filterByState(orders, current);
    download.disabled = visible.length === 0;
    download.textContent =
      current === 'todos'
        ? 'Descargar Excel'
        : `Descargar Excel (${STATE_LABELS[current].toLowerCase()})`;
    if (visible.length === 0) {
      list.replaceChildren(
        el(
          'li',
          'panel-empty',
          orders.length === 0 ? 'Todavía no hay pedidos.' : 'No hay pedidos con este estado.',
        ),
      );
      return;
    }
    list.replaceChildren(...visible.map(renderOrder));
  };

  const load = async () => {
    boardStatus.hidden = true;
    try {
      const check = await api('rpc/es_administrador', { method: 'POST', body: '{}' });
      if (check.status === 401) return showLogin('Tu sesión venció. Vuelve a entrar.');
      if (!check.ok || (await check.json()) !== true) {
        return showLogin('Esta cuenta no tiene permiso para ver los pedidos.');
      }
      const res = await api('pedidos?select=*&order=creado_en.desc&limit=500');
      if (!res.ok) throw new Error(String(res.status));
      orders = (await res.json()) as PanelOrder[];
      await loadStock();
      loginForm.hidden = true;
      board.hidden = false;
      render();
    } catch (error) {
      if (error instanceof Error && error.message === 'sesion') return showLogin();
      say(boardStatus, 'error', 'No se pudieron cargar los pedidos. Revisa tu conexión.');
      board.hidden = false;
      loginForm.hidden = true;
    }
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const data = new FormData(loginForm);
    const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      session = await authRequest('password', {
        email: String(data.get('email') ?? '').trim(),
        password: String(data.get('password') ?? ''),
      });
      saveSession(session);
      loginForm.reset();
      loginStatus.hidden = true;
      await load();
    } catch (error) {
      say(
        loginStatus,
        'error',
        error instanceof Error && error.message === 'credenciales'
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo conectar. Revisa tu conexión.',
      );
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  stockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(stockForm);
    const parsed = parseStockAdjustment(
      String(data.get('cantidad') ?? ''),
      String(data.get('motivo') ?? ''),
    );
    if (!parsed.ok) return say(stockStatus, 'error', parsed.error);
    const submit = stockForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const res = await api('rpc/ajustar_stock', {
        method: 'POST',
        body: JSON.stringify({ p_cantidad: parsed.cantidad, p_motivo: parsed.motivo }),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        say(
          stockStatus,
          'error',
          isStockError(payload)
            ? 'No puedes restar más potes de los que hay.'
            : 'No se pudo registrar. Revisa tu conexión.',
        );
        return;
      }
      stockForm.reset();
      await loadStock();
      say(stockStatus, 'success', `Registrado. Ahora hay ${String(payload)} potes.`);
    } catch (error) {
      if (error instanceof Error && error.message === 'sesion') return showLogin();
      say(stockStatus, 'error', 'No se pudo registrar. Revisa tu conexión.');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  refresh.addEventListener('click', () => void load());
  download.addEventListener('click', () => {
    const visible = filterByState(orders, current);
    if (visible.length === 0) return;
    const file = buildXlsx(
      'Pedidos',
      ordersToRows(visible),
      EXPORT_COLUMNS.map((c) => c.width),
    );
    const url = URL.createObjectURL(
      new Blob([file], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(current);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  logout.addEventListener('click', () => {
    if (session) {
      void fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` },
      }).catch(() => undefined);
    }
    showLogin();
  });

  if (session) void load();
}
