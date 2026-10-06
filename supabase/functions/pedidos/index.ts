/**
 * Edge Function del registro de pedidos de QUIMIVER (Supabase, Deno).
 *
 * POST: valida el pedido del formulario, lo guarda con su número (P-000001) y, si están
 *       los secretos de Brevo, avisa por correo al negocio. El cliente igual confirma por
 *       WhatsApp: si este registro falla, el sitio abre WhatsApp de todas formas.
 * GET:  verificación de estado.
 *
 * Secretos (Supabase → Edge Functions → Secrets). Nunca van en el código:
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: los pone Supabase.
 * - BREVO_API_KEY, MAIL_FROM (opcionales): aviso por correo de cada pedido nuevo.
 * - PEDIDOS_CORREO (opcional): a dónde llega el aviso; por defecto, el correo de `libro_proveedor`.
 * - ALLOWED_ORIGINS (opcional): reemplaza la lista de sitios que pueden registrar pedidos.
 */
import { validateOrder, type OrderRecord } from './pedido.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';
const MAX_BODY_BYTES = 8_000;
const MAX_PER_PHONE_PER_HOUR = 5;
// Tope de todo el sitio: frena a un robot que cambie de número en cada envío. Si se alcanza,
// el cliente igual pide por WhatsApp (el sitio lo abre aunque el registro falle).
const MAX_PER_HOUR = 60;

const DEFAULT_ORIGINS = 'https://edgarvilca.github.io,http://localhost:4321,http://localhost:4329';

function allowedOrigins(): string[] {
  return (env('ALLOWED_ORIGINS') || DEFAULT_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  const allow = origin && allowed.includes(origin) ? origin : (allowed[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function notifyBusiness(order: OrderRecord & { codigo: string }): Promise<void> {
  const apiKey = env('BREVO_API_KEY');
  const from = env('MAIL_FROM');
  if (!apiKey || !from) return;
  let to = env('PEDIDOS_CORREO');
  if (!to) {
    const res = await db('libro_proveedor?select=correo&limit=1');
    if (res.ok) to = ((await res.json()) as { correo: string }[])[0]?.correo ?? '';
  }
  if (!to) return;
  const lines = [
    `Pedido ${order.codigo}`,
    `Cliente: ${order.cliente_nombre}`,
    `Celular: ${order.telefono}`,
    `Ciudad: ${order.ciudad}`,
    `Presentación: ${order.presentacion} × ${order.cantidad} (${order.tipo_precio})`,
    `Entrega: ${order.entrega}`,
    `Total estimado: S/ ${order.total_estimado.toFixed(2)}`,
    ...(order.observaciones ? [`Observaciones: ${order.observaciones}`] : []),
  ];
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'QUIMIVER' },
      to: [{ email: to }],
      subject: `Nuevo pedido ${order.codigo} · ${order.cliente_nombre}`,
      textContent: lines.join('\n'),
    }),
  });
  if (!res.ok) console.error('Brevo', res.status, await res.text());
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method === 'GET') {
    const res = await db('pedidos?select=id&limit=1');
    return json({ ok: res.ok }, res.ok ? 200 : 503, origin);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405, origin);
  }

  if (!origin || !allowedOrigins().includes(origin)) {
    return json({ error: 'Origen no permitido.' }, 403, origin);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'El pedido es demasiado largo.' }, 413, origin);
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Formato no válido.' }, 400, origin);
  }

  // Campo trampa: las personas no lo ven; los robots lo llenan.
  if (typeof body.sitio_web === 'string' && body.sitio_web !== '') {
    return json({ error: 'No se pudo registrar.' }, 400, origin);
  }

  const result = validateOrder(body);
  if (!result.ok) {
    return json({ error: 'Revisa los datos del pedido.', errors: result.errors }, 422, origin);
  }
  const order = result.value;

  const since = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const count = async (filter: string) => {
    const res = await db(`pedidos?select=id&creado_en=gte.${since}${filter}`, {
      headers: { Prefer: 'count=exact', Range: '0-0' },
    });
    return Number(res.headers.get('Content-Range')?.split('/')[1] ?? '0');
  };
  if (
    (await count(`&telefono=eq.${encodeURIComponent(order.telefono)}`)) >= MAX_PER_PHONE_PER_HOUR
  ) {
    return json({ error: 'Demasiados pedidos seguidos desde este número.' }, 429, origin);
  }
  if ((await count('')) >= MAX_PER_HOUR) {
    console.error('Tope de pedidos por hora alcanzado');
    return json({ error: 'Recibimos muchos pedidos en este momento.' }, 429, origin);
  }

  const insert = await db('pedidos?select=codigo,creado_en', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(order),
  });
  if (!insert.ok) {
    console.error('Insert', insert.status, await insert.text());
    return json({ error: 'No se pudo registrar el pedido.' }, 500, origin);
  }
  const [stored] = (await insert.json()) as { codigo: string; creado_en: string }[];

  try {
    await notifyBusiness({ ...order, codigo: stored.codigo });
  } catch (error) {
    console.error('Aviso', error);
  }

  return json({ codigo: stored.codigo, creado_en: stored.creado_en }, 201, origin);
});
