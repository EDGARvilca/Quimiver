import { test as base, expect } from '@playwright/test';

/**
 * Todas las pruebas parten sin red real: Supabase responde error y WhatsApp devuelve una
 * página vacía. Cada prueba simula la respuesta que necesita con `context.route`, que tiene
 * prioridad sobre estas reglas por registrarse después.
 */
export const test = base.extend<{ errors: string[] }>({
  context: async ({ context }, use) => {
    await context.route(/\.supabase\.co\//, (route) => route.abort());
    await context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp</title>' }),
    );
    await use(context);
  },
  // Errores de JavaScript de la página; cada prueba confirma al final que no hubo ninguno.
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
});

export { expect };

/** Pide a la página que confirme que nada se sale por los costados. */
export async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
