/**
 * Monitoreo de QUIMIVER: revisa que la web y los servidores de pedidos y del Libro de
 * Reclamaciones respondan. Lo ejecuta `.github/workflows/monitoreo.yml` cada 6 horas; si algo
 * falla, el flujo abre un aviso (issue) en GitHub y lo cierra cuando se recupera.
 *
 * Sin dependencias. Uso: `node scripts/monitoreo.mjs [archivo-de-informe.md]`.
 * Sale con código 1 si alguna revisión falla.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SITE = 'https://edgarvilca.github.io/Quimiver/';
const FUNCTIONS = 'https://buuelzmvfidigimbrplm.supabase.co/functions/v1';

/** Cada revisión dice qué consultar y qué debe responder. `check` devuelve el problema o null. */
export const CHECKS = [
  {
    name: 'Página principal',
    url: SITE,
    check: (status, body) =>
      status !== 200
        ? `respondió ${status}`
        : !body.includes('id="order-form"')
          ? 'no aparece el formulario de pedido'
          : null,
  },
  {
    name: 'Página del Libro de Reclamaciones',
    url: `${SITE}libro-de-reclamaciones/`,
    check: (status, body) =>
      status !== 200
        ? `respondió ${status}`
        : !body.includes('id="complaints-form"')
          ? 'no aparece el formulario del libro'
          : null,
  },
  {
    name: 'Servidor de pedidos',
    url: `${FUNCTIONS}/pedidos`,
    check: (status, body) =>
      status !== 200 || json(body)?.ok !== true
        ? `respondió ${status}: ${body.slice(0, 120)}`
        : null,
  },
  {
    name: 'Servidor del Libro de Reclamaciones',
    url: `${FUNCTIONS}/libro-reclamaciones`,
    check: (status, body) => {
      const data = json(body);
      if (status !== 200 || data?.ok !== true) return `respondió ${status}: ${body.slice(0, 120)}`;
      return data.enabled === true
        ? null
        : 'el libro figura como no habilitado (faltan datos del proveedor)';
    },
  },
];

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Ejecuta las revisiones con reintentos; un fallo aislado de red no debe dar una alerta. */
export async function runChecks({
  fetchImpl = fetch,
  attempts = 3,
  waitMs = 10_000,
  timeoutMs = 20_000,
} = {}) {
  const results = [];
  for (const item of CHECKS) {
    let problem = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetchImpl(item.url, {
          headers: { 'user-agent': 'quimiver-monitoreo' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        problem = item.check(res.status, await res.text());
      } catch (error) {
        problem = `sin respuesta (${error instanceof Error ? error.message : String(error)})`;
      }
      if (!problem) break;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, waitMs));
    }
    results.push({ name: item.name, url: item.url, problem });
  }
  return results;
}

export function report(results, now = new Date()) {
  const when = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'long',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(now);
  const failing = results.filter((r) => r.problem);
  return [
    failing.length === 0
      ? `Todo responde bien (${when}, hora de Lima).`
      : `${failing.length} de ${results.length} revisiones fallan (${when}, hora de Lima).`,
    '',
    '| Revisión | Estado |',
    '| --- | --- |',
    ...results.map(
      (r) => `| [${r.name}](${r.url}) | ${r.problem ? `❌ ${r.problem}` : '✅ bien'} |`,
    ),
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const results = await runChecks();
  // Prueba del camino de aviso, a pedido desde GitHub (Actions → Monitoreo → Run workflow).
  if (process.env.MONITOREO_SIMULAR_FALLO) {
    results.push({ name: 'Falla simulada (prueba del aviso)', url: SITE, problem: 'prueba' });
  }
  const text = report(results);
  console.log(text);
  if (process.argv[2]) writeFileSync(process.argv[2], `${text}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  process.exitCode = results.some((r) => r.problem) ? 1 : 0;
}
