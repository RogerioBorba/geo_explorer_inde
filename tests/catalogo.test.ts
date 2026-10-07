import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/routes/api/inde/catalogos-servicos/ibge/+server.ts';

test('desdobra somente IBGE e preserva demais catálogos', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json([{ descricao: 'IBGE - Geral' }, { descricao: 'ANA - Dados', wmsGetCapabilities: 'https://ana.example/wms' }]);
  try {
    const response = await GET();
    const result = await response.json();
    assert.equal(result.filter((item: { sigla?: string }) => item.sigla === 'IBGE').length, 8);
    assert.deepEqual(result.at(-1), { descricao: 'ANA - Dados', wmsGetCapabilities: 'https://ana.example/wms' });
  } finally { globalThis.fetch = original; }
});
test('catálogo malformado responde erro controlado', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ erro: 'inválido' });
  try { assert.equal((await GET()).status, 502); } finally { globalThis.fetch = original; }
});
