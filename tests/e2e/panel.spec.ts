import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const order = (id: number, estado: string) => ({
  id,
  codigo: `P-${String(id).padStart(6, '0')}`,
  creado_en: '2026-10-06T15:30:00Z',
  cliente_nombre: 'Cliente de prueba',
  telefono: '987654321',
  ciudad: 'Huaraz',
  presentacion: 'Pote 50 g',
  cantidad: 6,
  precio_unitario: 20,
  tipo_precio: 'por mayor',
  entrega: 'Envío por Shalom',
  total_estimado: 120,
  observaciones: null,
  estado,
  notas_internas: null,
});

/** Simula Supabase: inicio de sesión, permiso de administrador y la tabla de pedidos. */
async function mockSupabase(
  context: BrowserContext,
  { admin, stock: initialStock = 100 }: { admin: boolean; stock?: number },
) {
  const orders = [order(2, 'nuevo'), order(1, 'pagado')];
  const patches: unknown[] = [];
  let stock = initialStock;
  const moves = [
    {
      cantidad: 100,
      stock_resultante: 100,
      motivo: 'Stock inicial',
      creado_en: '2026-10-06T08:00:00Z',
    },
  ];
  await context.route(/\/rest\/v1\/rpc\/ver_stock/, (route) =>
    route.fulfill({ json: { stock, movimientos: moves } }),
  );
  await context.route(/\/rest\/v1\/rpc\/ajustar_stock/, (route) => {
    const { p_cantidad, p_motivo } = route.request().postDataJSON();
    if (stock + p_cantidad < 0) {
      return route.fulfill({ status: 400, json: { code: 'P0001', message: 'Stock insuficiente' } });
    }
    stock += p_cantidad;
    moves.unshift({
      cantidad: p_cantidad,
      stock_resultante: stock,
      motivo: p_motivo,
      creado_en: '2026-10-06T09:00:00Z',
    });
    return route.fulfill({ json: stock });
  });
  await context.route(/\/auth\/v1\/token/, (route) =>
    route.request().postDataJSON().password === 'correcta'
      ? route.fulfill({
          json: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 },
        })
      : route.fulfill({ status: 400, json: { error: 'invalid_grant' } }),
  );
  await context.route(/\/auth\/v1\/logout/, (route) => route.fulfill({ status: 204 }));
  await context.route(/\/rest\/v1\/rpc\/es_administrador/, (route) =>
    route.fulfill({ json: admin }),
  );
  await context.route(/\/rest\/v1\/pedidos/, async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON();
      patches.push({ url: req.url(), body });
      const id = Number(new URL(req.url()).searchParams.get('id')?.replace('eq.', ''));
      const current = orders.find((o) => o.id === id)!;
      if (body.estado === 'confirmado' && current.cantidad > stock) {
        return route.fulfill({
          status: 400,
          json: { code: 'P0001', message: 'Stock insuficiente' },
        });
      }
      if (body.estado === 'confirmado') stock -= current.cantidad;
      const updated = { ...current, ...body };
      return route.fulfill({ json: [updated] });
    }
    return route.fulfill({ json: orders });
  });
  return patches;
}

async function login(page: Page, password: string) {
  await page.goto('panel/');
  await page.fill('#panel-email', 'admin@ejemplo.com');
  await page.fill('#panel-password', password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('rechaza una contraseña incorrecta', async ({ page, context }) => {
  await mockSupabase(context, { admin: true });
  await login(page, 'otra');
  await expect(page.locator('#panel-login-status')).toContainText(
    'Correo o contraseña incorrectos',
  );
  await expect(page.locator('#panel-board')).toBeHidden();
});

test('una cuenta sin permiso no ve pedidos', async ({ page, context }) => {
  await mockSupabase(context, { admin: false });
  await login(page, 'correcta');
  await expect(page.locator('#panel-login-status')).toContainText('no tiene permiso');
  await expect(page.locator('#panel-board')).toBeHidden();
});

test('el administrador filtra y cambia el estado', async ({ page, context, errors }) => {
  const patches = await mockSupabase(context, { admin: true });
  await login(page, 'correcta');

  await expect(page.locator('#panel-login')).toBeHidden();
  await expect(page.locator('.panel-order')).toHaveCount(2);
  await page.getByRole('button', { name: 'Pagado (1)' }).click();
  await expect(page.locator('.panel-order')).toHaveCount(1);
  await page.getByRole('button', { name: 'Todos (2)' }).click();

  const first = page.locator('.panel-order').first();
  await expect(first.locator('a[href^="https://wa.me/51987654321"]')).toBeVisible();
  await first.locator('select').selectOption('confirmado');
  await first.locator('textarea').fill('Pagó por Yape');
  await first.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('#panel-status')).toContainText('P-000002 quedó como Confirmado');
  expect(patches).toEqual([
    {
      url: expect.stringContaining('pedidos?id=eq.2'),
      body: { estado: 'confirmado', notas_internas: 'Pagó por Yape' },
    },
  ]);

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('#panel-login')).toBeVisible();
  expect(errors).toEqual([]);
});

test('muestra el stock y registra potes nuevos', async ({ page, context, errors }) => {
  await mockSupabase(context, { admin: true, stock: 8 });
  await login(page, 'correcta');

  await expect(page.locator('#panel-stock-count')).toHaveText('8');
  await expect(page.locator('#panel-stock-warning')).toContainText('Quedan pocos potes');

  await page.fill('#panel-stock-quantity', '50');
  await page.fill('#panel-stock-reason', 'Producción nueva');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.locator('#panel-stock-status')).toContainText('Ahora hay 58 potes');
  await expect(page.locator('#panel-stock-count')).toHaveText('58');
  await expect(page.locator('#panel-stock-warning')).toBeHidden();
  await page.locator('.panel-stock-moves summary').click();
  await expect(page.locator('#panel-stock-moves li').first()).toContainText(
    '+50 · Producción nueva',
  );
  expect(errors).toEqual([]);
});

test('no deja confirmar un pedido sin stock suficiente', async ({ page, context }) => {
  await mockSupabase(context, { admin: true, stock: 2 });
  await login(page, 'correcta');

  const first = page.locator('.panel-order').first();
  await first.locator('select').selectOption('confirmado');
  await first.getByRole('button', { name: 'Guardar' }).click();
  await expect(first.locator('.form-status')).toContainText('No hay stock suficiente');
  await expect(page.locator('#panel-stock-count')).toHaveText('2');
});

test('el resumen de ventas suma solo lo confirmado y se actualiza al guardar', async ({
  page,
  context,
  errors,
}) => {
  await mockSupabase(context, { admin: true });
  await login(page, 'correcta');

  const total = page.locator('.panel-sales-card').nth(2);
  await expect(total).toContainText('S/ 120.00');
  await expect(total).toContainText('6 potes · 1 pedido');
  await expect(page.locator('#panel-sales-cities')).toContainText('Huaraz: 6 potes');
  await expect(page.locator('#panel-sales-months tr')).toHaveCount(6);

  const first = page.locator('.panel-order').first();
  await first.locator('select').selectOption('confirmado');
  await first.getByRole('button', { name: 'Guardar' }).click();
  await expect(total).toContainText('S/ 240.00');
  expect(errors).toEqual([]);
});
