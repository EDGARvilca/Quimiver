/**
 * Edge Function del Libro de Reclamaciones virtual de QUIMIVER (Supabase, Deno).
 *
 * POST: valida la hoja, la guarda con su número correlativo y envía la copia
 *       al correo del consumidor y al del proveedor (art. 4-B del reglamento).
 * GET:  verificación de estado; mantiene activo el proyecto gratuito.
 *
 * Datos del proveedor (razón social, RUC, domicilio, correo): tabla `libro_proveedor`.
 * Mientras falten, el libro responde "no habilitado", porque la hoja debe llevarlos.
 *
 * Secretos (Supabase → Edge Functions → Secrets). Nunca van en el código:
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: los pone Supabase.
 * - BREVO_API_KEY y MAIL_FROM (remitente verificado en Brevo): envío de la copia por correo.
 * - ALLOWED_ORIGINS (opcional): reemplaza la lista de sitios que pueden enviar hojas.
 */
import {
  hojaEmail,
  hojaRows,
  validateComplaint,
  type Provider,
  type StoredComplaint,
} from './complaint.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';
const MAX_BODY_BYTES = 20_000;
const MAX_PER_EMAIL_PER_HOUR = 3;

const DEFAULT_ORIGINS = 'https://edgarvilca.github.io,http://localhost:4321,http://localhost:4329';

function allowedOrigins(): string[] {
  return (env('ALLOWED_ORIGINS') || DEFAULT_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

interface ProviderRow {
  nombre_comercial: string;
  razon_social: string | null;
  ruc: string | null;
  domicilio: string | null;
  correo: string;
  sitio_web: string;
}

async function provider(): Promise<Provider | null> {
  const res = await db('libro_proveedor?select=*&limit=1');
  if (!res.ok) return null;
  const [row] = (await res.json()) as ProviderRow[];
  if (!row?.razon_social || !row.ruc || !row.domicilio) return null;
  return {
    tradeName: row.nombre_comercial,
    businessName: row.razon_social,
    ruc: row.ruc,
    address: row.domicilio,
    email: row.correo,
    website: row.sitio_web,
  };
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

async function sendMail(to: string, subject: string, text: string, html: string, replyTo?: string) {
  const apiKey = env('BREVO_API_KEY');
  const from = env('MAIL_FROM');
  if (!apiKey || !from) return false;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'QUIMIVER' },
      to: [{ email: to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) console.error('Brevo', res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method === 'GET') {
    const prov = await provider();
    const res = await db('reclamos?select=id&limit=1');
    return json({ ok: res.ok, enabled: prov !== null }, res.ok ? 200 : 503, origin);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405, origin);
  }

  if (!origin || !allowedOrigins().includes(origin)) {
    return json({ error: 'Origen no permitido.' }, 403, origin);
  }

  const prov = await provider();
  if (!prov) {
    return json(
      { error: 'El Libro de Reclamaciones virtual aún no está habilitado.' },
      503,
      origin,
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'El mensaje es demasiado largo.' }, 413, origin);
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

  const result = validateComplaint(body);
  if (!result.ok) {
    return json({ error: 'Revisa los campos marcados.', errors: result.errors }, 422, origin);
  }
  const complaint = result.value;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db(
    `reclamos?select=id&correo=eq.${encodeURIComponent(complaint.correo)}&creado_en=gte.${encodeURIComponent(since)}`,
    { headers: { Prefer: 'count=exact', Range: '0-0' } },
  );
  const total = Number(recent.headers.get('Content-Range')?.split('/')[1] ?? '0');
  if (total >= MAX_PER_EMAIL_PER_HOUR) {
    return json(
      { error: 'Ya registraste varias hojas en la última hora. Intenta más tarde o escríbenos.' },
      429,
      origin,
    );
  }

  const insert = await db('reclamos?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(complaint),
  });
  if (!insert.ok) {
    console.error('Insert', insert.status, await insert.text());
    return json({ error: 'No se pudo registrar. Intenta de nuevo en unos minutos.' }, 500, origin);
  }
  const [stored] = (await insert.json()) as (StoredComplaint & { id: number })[];

  const mail = hojaEmail(stored, prov);
  const [toConsumer, toProvider] = await Promise.all([
    sendMail(stored.correo, mail.subject, mail.text, mail.html, prov.email),
    sendMail(prov.email, `[Nuevo] ${mail.subject}`, mail.text, mail.html, stored.correo),
  ]);
  const sentAt = new Date().toISOString();
  if (toConsumer || toProvider) {
    await db(`reclamos?id=eq.${stored.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(toConsumer ? { correo_consumidor_enviado_en: sentAt } : {}),
        ...(toProvider ? { correo_proveedor_enviado_en: sentAt } : {}),
      }),
    });
  }

  return json(
    {
      codigo: stored.codigo,
      creado_en: stored.creado_en,
      hoja: hojaRows(stored, prov),
      correoEnviado: toConsumer,
    },
    201,
    origin,
  );
});
