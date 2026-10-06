import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PEDIDOS = /\/functions\/v1\/pedidos$/;

async function fillOrder(page: Page, quantity: string) {
  await page.goto('#compra');
  await page.fill('#customer-name', 'Cliente de prueba');
  await page.fill('#phone', '987654321');
  await page.fill('#city', 'Huaraz');
  await page.fill('#quantity', quantity);
  await page.selectOption('#delivery', 'shalom');
  await page.check('#privacy-consent');
}

function whatsappText(url: string): string {
  return new URL(url).searchParams.get('text') ?? '';
}

test('aplica el precio por mayor desde 6 unidades', async ({ page }) => {
  await fillOrder(page, '1');
  await expect(page.locator('#order-total')).toContainText('S/ 25.00');
  await page.fill('#quantity', '6');
  await expect(page.locator('#order-total')).toContainText('S/ 120.00');
  await expect(page.locator('#order-total')).toContainText('por mayor');
});

test('registra el pedido y abre WhatsApp con su número', async ({ page, context, errors }) => {
  let sent: Record<string, unknown> = {};
  await context.route(PEDIDOS, async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { codigo: 'P-000123' } });
  });
  await fillOrder(page, '6');

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const whatsapp = await popup;
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);

  expect(whatsappText(whatsapp.url())).toContain('*Pedido N.º:* P-000123');
  expect(sent).toMatchObject({
    cliente_nombre: 'Cliente de prueba',
    telefono: '987654321',
    cantidad: 6,
    precio_unitario: 20,
    tipo_precio: 'por mayor',
    total_estimado: 120,
    sitio_web: '',
  });
  await expect(page.locator('#order-status')).toContainText('P-000123');
  await expect(page.locator('#order-status a')).toHaveAttribute(
    'href',
    /\/seguimiento\/\?pedido=P-000123$/,
  );
  expect(errors).toEqual([]);
});

test('si el registro falla, WhatsApp se abre igual sin número', async ({ page, errors }) => {
  // La regla base de las pruebas hace fallar a Supabase.
  await fillOrder(page, '2');

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const whatsapp = await popup;
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);

  const text = whatsappText(whatsapp.url());
  expect(text).not.toContain('Pedido N.º');
  expect(text).toContain('Cliente de prueba');
  await expect(page.locator('#order-status')).toContainText('Abrimos WhatsApp');
  expect(errors).toEqual([]);
});

test('no envía nada si faltan datos', async ({ page, context }) => {
  let calls = 0;
  await context.route(PEDIDOS, (route) => {
    // La página consulta el stock con GET al cargar; aquí solo cuentan los envíos.
    if (route.request().method() === 'POST') calls += 1;
    return route.abort();
  });
  await page.goto('#compra');
  let popups = 0;
  page.on('popup', () => (popups += 1));
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const missing = await page
    .locator('#customer-name')
    .evaluate((input) => (input as HTMLInputElement).validity.valueMissing);
  expect(missing).toBe(true);
  expect(calls).toBe(0);
  expect(popups).toBe(0);
});

test('avisa que está agotado sin bloquear el pedido', async ({ page, context }) => {
  await context.route(PEDIDOS, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { ok: true, disponible: false } })
      : route.abort(),
  );
  await page.goto('#compra');
  await expect(page.locator('#order-stock')).toBeVisible();
  await expect(page.locator('#order-stock')).toContainText('agotado');
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
});

test('no muestra el aviso cuando hay stock', async ({ page, context }) => {
  await context.route(PEDIDOS, (route) => route.fulfill({ json: { ok: true, disponible: true } }));
  const checked = page.waitForResponse(PEDIDOS);
  await page.goto('#compra');
  await checked;
  await expect(page.locator('#order-stock')).toBeHidden();
});
