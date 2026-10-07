import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obterResposta } from '../src/lib/request/transporte.ts';

test('mantém timeout durante leitura do corpo', async () => {
  const fetcher: typeof fetch = async (_input, init) => new Response(new ReadableStream({
    start(controller) { init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason)); }
  }));
  await assert.rejects(obterResposta('https://servico.example/wms', { timeout: 15 }, fetcher), /tempo limite/i);
});
test('respeita cancelamento e não tenta proxy após aborto', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(obterResposta('https://servico.example/wms', { signal: controller.signal, proxyOrigin: 'https://app.example' }, async () => { calls++; return new Response(''); }));
  assert.equal(calls, 0);
});
test('codifica destino no proxy e preserva status HTTP sem repetição', async () => {
  let calls = 0;
  const response = await obterResposta('https://servico.example/wms?a=1&b=á', { proxyOrigin: 'https://app.example' }, async input => {
    calls++;
    if (calls === 1) throw new TypeError('rede');
    assert.equal(new URL(String(input)).searchParams.get('url'), 'https://servico.example/wms?a=1&b=%C3%A1');
    return new Response('erro', { status: 503, headers: { 'Content-Type': 'text/xml' } });
  });
  assert.equal(response.status, 503); assert.equal(calls, 2);
  assert.equal(response.headers.get('content-type'), 'text/xml');
});
