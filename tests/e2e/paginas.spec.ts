import { expect, expectNoHorizontalOverflow, test } from './fixtures';

const PAGES = [
  '',
  'productos/quimiver/',
  'nosotros/',
  'envios/',
  'contacto/',
  'cambios-y-devoluciones/',
  'politica-de-privacidad/',
  'libro-de-reclamaciones/',
  'panel/',
];

for (const path of PAGES) {
  test(`/${path} carga sin errores ni desbordes`, async ({ page, errors }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('los enlaces internos no están rotos', async ({ page, request }) => {
  const seen = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    const hrefs = await page.$$eval('a[href]', (links) =>
      links.map((a) => (a as HTMLAnchorElement).href),
    );
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== new URL(page.url()).origin) continue;
      url.hash = '';
      seen.add(url.href);
    }
  }
  for (const url of seen) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
  }
});

test('el panel no se indexa y no aparece en el sitemap', async ({ page, request }) => {
  await page.goto('panel/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const sitemap = await (await request.get('sitemap.xml')).text();
  expect(sitemap).toContain('/Quimiver/nosotros/');
  expect(sitemap).not.toContain('/panel/');
});
