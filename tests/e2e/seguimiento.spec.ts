import type { BrowserContext } from '@playwright/test';
import { expect, expectNoHorizontalOverflow, test } from './fixtures';

const RPC = /\/rest\/v1\/rpc\/seguir_pedido/;

async function mockLookup(
  context: BrowserContext,
  reply: (body: Record<string, string>) => unknown,
) {
  const calls: Record<string, string>[] = [];
  await context.route(RPC, async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    await route.fulfill({ json: reply(body) });
  });
  return calls;
}

const found = (estado: string, entrega = 'Envío por Shalom (costo según destino)') => ({
  ok: true,
  codigo: 'P-000123',
  estado,
  creado_en: '2026-10-06T15:30:00Z',
  presentacion: 'Frasco de 50 g',
  cantidad: 6,
  entrega,
  total_estimado: 120,
});

test('muestra el avance de un pedido pagado', async ({ page, context, errors }) => {
  const calls = await mockLookup(context, () => found('pagado'));
  await page.goto('seguimiento/?pedido=p-123');
  await expect(page.locator('#tracking-code')).toHaveValue('P-000123');
  await page.fill('#tracking-phone', '+51 987 654 321');
  await page.getByRole('button', { name: 'Consultar' }).click();

  const result = page.locator('#tracking-result');
  await expect(result).toBeVisible();
  await expect(page.locator('#tracking-result-title')).toHaveText('Pagado');
  await expect(result).toContainText('Estamos preparando tu envío');
  await expect(page.locator('#tracking-steps li[data-status="hecho"]')).toHaveCount(2);
  await expect(page.locator('#tracking-steps li[aria-current="step"]')).toHaveText('Pagado');
  await expect(result).toContainText('6 × Frasco de 50 g');
  await expect(result).toContainText('S/ 120.00');
  expect(calls).toEqual([{ p_codigo: 'P-000123', p_telefono: '+51 987 654 321' }]);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('para recojo dice "Listo para recoger"', async ({ page, context }) => {
  await mockLookup(context, () => found('enviado', 'Recojo en Lima (costo según zona)'));
  await page.goto('seguimiento/');
  await page.fill('#tracking-code', '123');
  await page.fill('#tracking-phone', '987654321');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.locator('#tracking-result-title')).toHaveText('Listo para recoger');
});

test('un pedido cancelado no muestra pasos', async ({ page, context }) => {
  await mockLookup(context, () => found('cancelado'));
  await page.goto('seguimiento/?pedido=P-000123');
  await page.fill('#tracking-phone', '987654321');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.locator('#tracking-result-title')).toHaveText('Cancelado');
  await expect(page.locator('#tracking-steps')).toBeHidden();
});

test('avisa si no encuentra el pedido o faltan datos', async ({ page, context, errors }) => {
  const calls = await mockLookup(context, () => ({ ok: false, error: 'no_encontrado' }));
  await page.goto('seguimiento/');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.locator('#tracking-status')).toContainText('Revisa el número de pedido');
  expect(calls).toHaveLength(0);

  await page.fill('#tracking-code', 'P-000999');
  await page.fill('#tracking-phone', '987654321');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.locator('#tracking-status')).toContainText('No encontramos un pedido');
  await expect(page.locator('#tracking-result')).toBeHidden();
  expect(errors).toEqual([]);
});

test('si no hay conexión lo dice', async ({ page }) => {
  await page.goto('seguimiento/?pedido=P-000123');
  await page.fill('#tracking-phone', '987654321');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.locator('#tracking-status')).toContainText('No pudimos consultar tu pedido');
});
