import { describe, expect, it } from 'vitest';
import { assetUrl, withBase } from '../src/lib/paths';

describe('withBase', () => {
  it('no cambia la ruta cuando el sitio está en la raíz', () => {
    expect(withBase('/productos/quimiver/', '/')).toBe('/productos/quimiver/');
    expect(withBase('/#compra', '/')).toBe('/#compra');
  });

  it('antepone la subcarpeta de GitHub Pages', () => {
    expect(withBase('/productos/quimiver/', '/Quimiver/')).toBe('/Quimiver/productos/quimiver/');
    expect(withBase('/', '/Quimiver')).toBe('/Quimiver/');
  });

  it('acepta rutas sin barra inicial', () => {
    expect(withBase('sitemap.xml', '/Quimiver/')).toBe('/Quimiver/sitemap.xml');
  });
});

describe('assetUrl', () => {
  it('antepone la subcarpeta a los archivos de public/', () => {
    expect(assetUrl('/images/quimiver-frascos.webp', '/Quimiver/')).toBe(
      '/Quimiver/images/quimiver-frascos.webp',
    );
  });

  it('no cambia las URLs externas', () => {
    expect(assetUrl('https://example.com/a.webp', '/Quimiver/')).toBe('https://example.com/a.webp');
  });
});
