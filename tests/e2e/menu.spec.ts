import { expect, test } from './fixtures';

test('el menú del celular abre y lleva a Nosotros', async ({ page, isMobile, errors }) => {
  test.skip(!isMobile, 'El botón de menú solo existe en pantallas pequeñas.');
  await page.goto('');
  const toggle = page.locator('[data-nav-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Nosotros' }).first().click();
  await expect(page).toHaveURL(/\/nosotros\/$/);
  expect(errors).toEqual([]);
});
