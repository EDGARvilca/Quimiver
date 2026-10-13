import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Revisión automática de accesibilidad (WCAG 2.1 nivel A y AA) con axe en cada página pública
 * y en el panel. Encuentra problemas como contraste, etiquetas, nombres de botones o encabezados.
 */
const PAGES = [
  '',
  'productos/quimiver/',
  'nosotros/',
  'envios/',
  'contacto/',
  'cambios-y-devoluciones/',
  'politica-de-privacidad/',
  'libro-de-reclamaciones/',
  'seguimiento/',
  'panel/',
];

for (const path of PAGES) {
  test(`/${path} cumple WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Las secciones aparecen con una animación al llegar a ellas; se muestran todas, como las
    // vería alguien que recorrió la página, para no medir el contraste a medio aparecer.
    await page.evaluate(() =>
      document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-visible')),
    );
    await page.waitForTimeout(1200);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const resumen = violations.map((v) => ({
      regla: v.id,
      impacto: v.impact,
      ayuda: v.help,
      nodos: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    }));
    expect(resumen).toEqual([]);
  });
}

test('el primer Tab lleva a "Saltar al contenido" y salta el menú', async ({ page }) => {
  await page.goto('contacto/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido')).toBeFocused();
  await page.keyboard.press('Tab');
  // El siguiente foco ya está dentro del contenido, no en el menú.
  expect(await page.evaluate(() => !!document.activeElement?.closest('#contenido'))).toBe(true);
});

test('todo lo que recibe foco con el teclado muestra dónde está', async ({ page }) => {
  for (const path of ['', 'libro-de-reclamaciones/', 'seguimiento/']) {
    await page.goto(path);
    const sinMarca: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const marcado =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
          s.boxShadow !== 'none' ||
          el.matches('.skip-link');
        return {
          marcado,
          nombre: `${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 30) ?? ''}`,
        };
      });
      if (!info) break;
      if (!info.marcado) sinMarca.push(info.nombre);
    }
    expect(sinMarca, `/${path}`).toEqual([]);
  }
});
