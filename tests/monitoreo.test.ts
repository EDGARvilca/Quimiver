import { describe, expect, it } from 'vitest';
import { CHECKS, report, runChecks } from '../scripts/monitoreo.mjs';

type Reply = { status: number; body: string } | Error;

function fakeFetch(replies: Record<string, Reply[]>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const reply = replies[url]?.shift() ?? { status: 200, body: '' };
    if (reply instanceof Error) throw reply;
    return new Response(reply.body, { status: reply.status });
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

const healthy = (): Record<string, Reply[]> => ({
  [CHECKS[0].url]: [{ status: 200, body: '<form id="order-form">' }],
  [CHECKS[1].url]: [{ status: 200, body: '<form id="complaints-form">' }],
  [CHECKS[2].url]: [{ status: 200, body: '{"ok":true}' }],
  [CHECKS[3].url]: [{ status: 200, body: '{"ok":true,"enabled":true}' }],
});

describe('monitoreo', () => {
  it('no avisa cuando todo responde', async () => {
    const { impl } = fakeFetch(healthy());
    const results = await runChecks({ fetchImpl: impl, waitMs: 0 });
    expect(results.every((r) => r.problem === null)).toBe(true);
    expect(report(results)).toContain('Todo responde bien');
  });

  it('reintenta y no avisa por un fallo aislado', async () => {
    const replies = healthy();
    replies[CHECKS[2].url].unshift(new Error('timeout'));
    const { impl, calls } = fakeFetch(replies);
    const results = await runChecks({ fetchImpl: impl, waitMs: 0 });
    expect(results[2].problem).toBeNull();
    expect(calls.filter((u) => u === CHECKS[2].url)).toHaveLength(2);
  });

  it('avisa cuando un servidor sigue caído', async () => {
    const replies = healthy();
    replies[CHECKS[2].url] = [503, 503, 503].map((status) => ({ status, body: 'pausado' }));
    const { impl } = fakeFetch(replies);
    const results = await runChecks({ fetchImpl: impl, waitMs: 0 });
    expect(results[2].problem).toContain('503');
    expect(report(results)).toContain('1 de 4 revisiones fallan');
  });

  it('detecta el libro deshabilitado y la página sin formulario', async () => {
    const replies = healthy();
    replies[CHECKS[0].url] = Array(3).fill({ status: 200, body: '<h1>otra cosa</h1>' });
    replies[CHECKS[3].url] = Array(3).fill({ status: 200, body: '{"ok":true,"enabled":false}' });
    const { impl } = fakeFetch(replies);
    const results = await runChecks({ fetchImpl: impl, waitMs: 0 });
    expect(results[0].problem).toContain('formulario de pedido');
    expect(results[3].problem).toContain('no habilitado');
  });
});
