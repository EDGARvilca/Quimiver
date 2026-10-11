import { formatCurrency } from '../lib/order';
import {
  CUSTOMER_COLUMNS,
  customerWhatsApp,
  customersToRows,
  filterCustomers,
  formatOrderDate,
  limaDateTime,
  plural,
  summarizeCustomers,
  type Customer,
  type PanelOrder,
} from '../lib/panel';
import { downloadXlsx } from './download';

/**
 * Sección "Clientes" del panel. No pide nada a la base: se arma con los pedidos que el
 * panel ya cargó. Devuelve la función que la vuelve a dibujar cuando cambian los pedidos.
 */
export function initCustomers(): (orders: PanelOrder[]) => void {
  const count = document.getElementById('panel-customers-count');
  const search = document.getElementById('panel-customers-search');
  const download = document.getElementById('panel-customers-download');
  const body = document.getElementById('panel-customers-list');
  if (
    !count ||
    !(search instanceof HTMLInputElement) ||
    !(download instanceof HTMLButtonElement) ||
    !body
  ) {
    return () => undefined;
  }

  let customers: Customer[] = [];

  const cell = (tag: 'td' | 'th', ...children: (Node | string)[]) => {
    const node = document.createElement(tag);
    node.append(...children);
    return node;
  };
  const small = (text: string) => {
    const node = document.createElement('small');
    node.textContent = text;
    return node;
  };

  const row = (c: Customer): HTMLTableRowElement => {
    const tr = document.createElement('tr');
    const name = cell('th', c.nombre || 'Sin nombre', small(c.ciudad));
    name.scope = 'row';
    const phone = document.createElement('a');
    phone.href = customerWhatsApp(c.telefono, c.ultimo_codigo, 'Hola, te escribimos de QUIMIVER.');
    phone.target = '_blank';
    phone.rel = 'noopener';
    phone.textContent = c.telefono;
    phone.setAttribute('aria-label', `WhatsApp de ${c.nombre || c.telefono}: ${c.telefono}`);
    tr.append(
      name,
      cell('td', phone),
      cell('td', String(c.pedidos)),
      cell('td', formatCurrency(c.soles), small(plural(c.potes, 'pote', 'potes'))),
      cell('td', formatOrderDate(c.ultimo_pedido), small(c.ultimo_codigo)),
    );
    tr.lastElementChild?.setAttribute('title', limaDateTime(c.ultimo_pedido));
    return tr;
  };

  const draw = () => {
    const visible = filterCustomers(customers, search.value);
    download.disabled = visible.length === 0;
    if (visible.length === 0) {
      const empty = cell(
        'td',
        customers.length === 0 ? 'Todavía no hay clientes.' : 'Ningún cliente coincide.',
      );
      empty.colSpan = 5;
      empty.className = 'panel-empty-cell';
      const tr = document.createElement('tr');
      tr.append(empty);
      body.replaceChildren(tr);
      return;
    }
    body.replaceChildren(...visible.map(row));
  };

  search.addEventListener('input', draw);
  download.addEventListener('click', () => {
    const visible = filterCustomers(customers, search.value);
    if (visible.length === 0) return;
    const day = limaDateTime(new Date().toISOString()).slice(0, 10);
    downloadXlsx(
      'Clientes',
      customersToRows(visible),
      CUSTOMER_COLUMNS.map((c) => c.width),
      `clientes-quimiver-${day}.xlsx`,
    );
  });

  return (orders) => {
    customers = summarizeCustomers(orders);
    count.textContent = `(${customers.length})`;
    draw();
  };
}
