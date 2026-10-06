import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const LIBRO = /\/functions\/v1\/libro-reclamaciones$/;

async function fillComplaint(page: Page) {
  await page.goto('libro-de-reclamaciones/');
  await page.fill('#consumidor_nombre', 'Cliente de prueba');
  await page.selectOption('#documento_tipo', 'DNI');
  await page.fill('#documento_numero', '12345678');
  await page.fill('#domicilio', 'Jr. Ejemplo 123, Huaraz, Áncash');
  await page.fill('#telefono', '987654321');
  await page.fill('#correo', 'cliente@ejemplo.com');
  await page.fill('#detalle', 'El pote llegó con la tapa rota.');
  await page.fill('#pedido', 'Cambio del producto.');
  await page.check('#complaints-consent');
}

test('marca los campos que faltan sin enviar nada', async ({ page, context }) => {
  let calls = 0;
  await context.route(LIBRO, (route) => {
    calls += 1;
    return route.abort();
  });
  await page.goto('libro-de-reclamaciones/');
  await page.getByRole('button', { name: 'Enviar hoja de reclamación' }).click();
  await expect(page.locator('#complaints-status')).toContainText('Revisa los campos marcados');
  await expect(page.locator('#consumidor_nombre')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#correo')).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toBe(0);
});

test('muestra la hoja registrada con su número', async ({ page, context, errors }) => {
  let sent: Record<string, unknown> = {};
  await context.route(LIBRO, async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        codigo: 'LR-000099',
        correoEnviado: false,
        hoja: [
          ['Hoja N.º', 'LR-000099'],
          ['Tipo', 'Reclamo'],
        ],
      },
    });
  });
  await fillComplaint(page);
  await page.getByRole('button', { name: 'Enviar hoja de reclamación' }).click();

  await expect(page.locator('#complaints-receipt')).toBeVisible();
  await expect(page.locator('#complaints-receipt-note')).toContainText('LR-000099');
  await expect(page.locator('#complaints-receipt-rows')).toContainText('Reclamo');
  await expect(page.locator('#complaints-form')).toBeHidden();
  expect(sent).toMatchObject({ consumidor_nombre: 'Cliente de prueba', tipo: 'reclamo' });
  expect(errors).toEqual([]);
});

test('sin conexión avisa y deja el formulario lleno', async ({ page }) => {
  await fillComplaint(page);
  await page.getByRole('button', { name: 'Enviar hoja de reclamación' }).click();
  await expect(page.locator('#complaints-status')).toContainText('No hay conexión');
  await expect(page.locator('#consumidor_nombre')).toHaveValue('Cliente de prueba');
});

test('el campo del apoderado aparece solo para menores de edad', async ({ page }) => {
  await page.goto('libro-de-reclamaciones/');
  await expect(page.locator('#apoderado_nombre')).toBeHidden();
  await page.check('#menor_de_edad');
  await expect(page.locator('#apoderado_nombre')).toBeVisible();
  await page.uncheck('#menor_de_edad');
  await expect(page.locator('#apoderado_nombre')).toBeHidden();
});
