/**
 * Hoja de Reclamación del Libro de Reclamaciones virtual
 * (D.S. 011-2011-PCM, Anexo I, y modificatorias; plazo de respuesta de la Ley 31435).
 *
 * TypeScript puro, sin dependencias: lo usan el formulario del sitio (Node/Astro),
 * la Edge Function (Deno) y las pruebas. Las reglas coinciden con la tabla `reclamos`.
 */

export const RESPONSE_DEADLINE_BUSINESS_DAYS = 15;

export const DOCUMENT_TYPES = ['DNI', 'CE', 'Pasaporte', 'RUC'] as const;
export const COMPLAINT_TYPES = ['reclamo', 'queja'] as const;
export const ITEM_TYPES = ['producto', 'servicio'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];

export interface Complaint {
  tipo: ComplaintType;
  consumidor_nombre: string;
  documento_tipo: DocumentType;
  documento_numero: string;
  domicilio: string;
  telefono: string;
  correo: string;
  menor_de_edad: boolean;
  apoderado_nombre: string | null;
  bien_tipo: ItemType;
  monto: number | null;
  bien_descripcion: string;
  numero_pedido: string | null;
  detalle: string;
  pedido: string;
}

/** Datos del proveedor que deben figurar en la hoja. */
export interface Provider {
  tradeName: string;
  businessName: string;
  ruc: string;
  address: string;
  email: string;
  website: string;
}

export interface StoredComplaint extends Complaint {
  codigo: string;
  creado_en: string;
}

export type ValidationResult =
  { ok: true; value: Complaint } | { ok: false; errors: Record<string, string> };

const DOCUMENT_PATTERNS: Record<DocumentType, RegExp> = {
  DNI: /^\d{8}$/,
  CE: /^[A-Za-z0-9]{8,12}$/,
  Pasaporte: /^[A-Za-z0-9]{6,12}$/,
  RUC: /^(10|15|17|20)\d{9}$/,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(input: unknown): string {
  return typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
}

/** Igual que `text`, pero respeta los saltos de línea de los campos largos. */
function longText(input: unknown): string {
  return typeof input === 'string'
    ? input
        .trim()
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
    : '';
}

function oneOf<T extends string>(input: unknown, options: readonly T[]): T | null {
  return typeof input === 'string' && (options as readonly string[]).includes(input)
    ? (input as T)
    : null;
}

/** Valida y normaliza lo que envía el formulario. Nunca confía en el navegador. */
export function validateComplaint(input: unknown): ValidationResult {
  const data = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const errors: Record<string, string> = {};

  const tipo = oneOf(data.tipo, COMPLAINT_TYPES);
  if (!tipo) errors.tipo = 'Elige si es un reclamo o una queja.';

  const consumidor_nombre = text(data.consumidor_nombre);
  if (consumidor_nombre.length < 2 || consumidor_nombre.length > 120)
    errors.consumidor_nombre = 'Escribe tu nombre completo.';

  const documento_tipo = oneOf(data.documento_tipo, DOCUMENT_TYPES);
  const documento_numero = text(data.documento_numero).replace(/\s/g, '');
  if (!documento_tipo) errors.documento_tipo = 'Elige el tipo de documento.';
  else if (!DOCUMENT_PATTERNS[documento_tipo].test(documento_numero))
    errors.documento_numero = `El número de ${documento_tipo} no es válido.`;

  const domicilio = text(data.domicilio);
  if (domicilio.length < 5 || domicilio.length > 200)
    errors.domicilio = 'Escribe tu domicilio (dirección, distrito y provincia).';

  const telefono = text(data.telefono).replace(/[\s-]/g, '');
  if (!/^\+?\d{6,15}$/.test(telefono)) errors.telefono = 'Escribe un teléfono válido.';

  const correo = text(data.correo).toLowerCase();
  if (!EMAIL.test(correo) || correo.length > 120)
    errors.correo = 'Escribe un correo válido: ahí te llegará la copia de tu hoja.';

  const menor_de_edad = data.menor_de_edad === true || data.menor_de_edad === 'on';
  const apoderado = text(data.apoderado_nombre);
  const apoderado_nombre = menor_de_edad ? apoderado : null;
  if (menor_de_edad && (apoderado.length < 2 || apoderado.length > 120))
    errors.apoderado_nombre =
      'Si eres menor de edad, escribe el nombre de tu padre, madre o apoderado.';

  const bien_tipo = oneOf(data.bien_tipo, ITEM_TYPES);
  if (!bien_tipo) errors.bien_tipo = 'Elige si se trata de un producto o un servicio.';

  const montoRaw = text(data.monto).replace(',', '.');
  let monto: number | null = null;
  if (montoRaw !== '') {
    const parsed = Number(montoRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99999999)
      errors.monto = 'Escribe el monto en soles, por ejemplo 25.00.';
    else monto = Math.round(parsed * 100) / 100;
  }

  const bien_descripcion = text(data.bien_descripcion);
  if (bien_descripcion.length < 3 || bien_descripcion.length > 300)
    errors.bien_descripcion =
      'Indica el producto o servicio, por ejemplo "QUIMIVER, frasco de 50 g".';

  const pedidoRaw = text(data.numero_pedido);
  const numero_pedido = pedidoRaw === '' ? null : pedidoRaw.slice(0, 40);

  const detalle = longText(data.detalle);
  if (detalle.length < 10 || detalle.length > 3000)
    errors.detalle = 'Cuéntanos qué pasó (entre 10 y 3000 caracteres).';

  const pedido = longText(data.pedido);
  if (pedido.length < 5 || pedido.length > 1500)
    errors.pedido = 'Indica qué solicitas (entre 5 y 1500 caracteres).';

  if (Object.keys(errors).length > 0 || !tipo || !documento_tipo || !bien_tipo) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      tipo,
      consumidor_nombre,
      documento_tipo,
      documento_numero: documento_numero.toUpperCase(),
      domicilio,
      telefono,
      correo,
      menor_de_edad,
      apoderado_nombre,
      bien_tipo,
      monto,
      bien_descripcion,
      numero_pedido,
      detalle,
      pedido,
    },
  };
}

/** Fecha y hora en Lima, como debe constar en la hoja. */
export function formatLimaDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'long',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export const LEGENDS = {
  reclamo: 'Reclamo: disconformidad relacionada con los productos o servicios.',
  queja:
    'Queja: disconformidad no relacionada con los productos o servicios, o malestar o descontento respecto a la atención al público.',
  plazo: `El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a ${RESPONSE_DEADLINE_BUSINESS_DAYS} días hábiles.`,
  indecopi:
    'La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.',
} as const;

/** Filas de la hoja en orden, para el correo, la constancia en pantalla y la impresión. */
export function hojaRows(c: StoredComplaint, provider: Provider): [string, string][] {
  const money = c.monto === null ? 'No indicado' : `S/ ${Number(c.monto).toFixed(2)}`;
  return [
    ['Hoja de reclamación N.º', c.codigo],
    ['Fecha y hora', formatLimaDateTime(c.creado_en)],
    ['Proveedor', `${provider.businessName} (${provider.tradeName})`],
    ['RUC', provider.ruc],
    ['Domicilio del proveedor', provider.address],
    ['Consumidor', c.consumidor_nombre],
    ['Documento', `${c.documento_tipo} ${c.documento_numero}`],
    ['Domicilio', c.domicilio],
    ['Teléfono', c.telefono],
    ['Correo', c.correo],
    ...(c.menor_de_edad
      ? ([['Padre, madre o apoderado', c.apoderado_nombre ?? '']] as [string, string][])
      : []),
    ['Bien contratado', c.bien_tipo === 'producto' ? 'Producto' : 'Servicio'],
    ['Monto reclamado', money],
    ['Descripción', c.bien_descripcion],
    ...(c.numero_pedido
      ? ([['N.º de pedido o comprobante', c.numero_pedido]] as [string, string][])
      : []),
    ['Tipo', c.tipo === 'reclamo' ? 'Reclamo' : 'Queja'],
    ['Detalle', c.detalle],
    ['Pedido del consumidor', c.pedido],
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Correo con la copia de la hoja (texto y HTML). */
export function hojaEmail(
  c: StoredComplaint,
  provider: Provider,
): {
  subject: string;
  text: string;
  html: string;
} {
  const rows = hojaRows(c, provider);
  const subject = `Hoja de reclamación ${c.codigo} · ${provider.tradeName}`;
  const legends = [LEGENDS.plazo, LEGENDS.indecopi];
  const text = [
    `Libro de Reclamaciones virtual de ${provider.tradeName}`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    ...legends,
    '',
    `Responderemos a ${c.correo}. Consultas: ${provider.email} · ${provider.website}`,
  ].join('\n');
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#15211b">
<h1 style="font-size:20px">Libro de Reclamaciones · ${escapeHtml(provider.tradeName)}</h1>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `<tr><th align="left" style="border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(k)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
  )
  .join('\n')}
</table>
${legends.map((l) => `<p style="font-size:13px">${escapeHtml(l)}</p>`).join('\n')}
<p style="font-size:13px">Consultas: ${escapeHtml(provider.email)} · ${escapeHtml(provider.website)}</p>
</body></html>`;
  return { subject, text, html };
}
