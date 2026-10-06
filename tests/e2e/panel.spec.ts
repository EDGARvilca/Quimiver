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
async function mockSupabase(context: BrowserContext, { admin }: { admin: boolean }) {
  const orders = [order(2, 'nuevo'), order(1, 'pagado')];
  const patches: unknown[] = [];
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
      const updated = { ...orders.find((o) => o.id === id)!, ...body };
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
