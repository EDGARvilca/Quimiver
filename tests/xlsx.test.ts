import { describe, expect, it } from 'vitest';
import { buildXlsx, columnName, zip } from '../src/lib/xlsx';

const dec = new TextDecoder();

/** Lee las entradas de un ZIP sin comprimir (como los que genera `zip`). */
function readZip(data: Uint8Array): Record<string, string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(8, true)).toBe(0); // sin compresión
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = dec.decode(data.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength;
    files[name] = dec.decode(data.subarray(start, start + size));
    at = start + size;
  }
  expect(view.getUint32(at, true)).toBe(0x02014b50); // índice central
  return files;
}

describe('excel', () => {
  it('nombra las columnas como Excel', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });

  it('calcula el CRC del ZIP como el estándar', () => {
    const out = zip([{ name: 'a.txt', data: new TextEncoder().encode('hola') }]);
    const view = new DataView(out.buffer);
    // CRC-32 de "hola" (mismo valor que zlib.crc32).
    expect(view.getUint32(14, true)).toBe(0x6fa0f988);
  });

  it('arma un libro con las partes que Excel necesita', () => {
    const files = readZip(
      buildXlsx('Pedidos', [
        ['Pedido', 'Potes', 'Notas'],
        ['P-000001', 6, 'Tomó <2> & "pagó"\u0001'],
        ['P-000002', 1, null],
      ]),
    );
    expect(Object.keys(files)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Pedido</t>');
    expect(sheet).toContain('<c r="B2"><v>6</v></c>');
    expect(sheet).toContain('Tomó &lt;2&gt; &amp; &quot;pagó&quot;');
    expect(sheet).not.toContain('r="C3"');
    expect(files['xl/workbook.xml']).toContain('<sheet name="Pedidos"');
  });
});
