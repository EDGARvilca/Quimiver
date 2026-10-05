import { describe, expect, it } from 'vitest';
import { withBase } from '../src/lib/paths';

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
