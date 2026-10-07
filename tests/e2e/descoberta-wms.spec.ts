import { test, expect } from '@playwright/test';

// Catálogo simples; grupos recursivos têm cenários próprios em painel-wms.spec.ts.
const capabilities = `<?xml version="1.0"?><WMS_Capabilities version="1.3.0"><Service><Name>WMS</Name><Title>IBGE</Title></Service><Capability><Layer><Title>Dados</Title><Layer><Name>ibge:municipios</Name><Title>Municípios brasileiros</Title></Layer><Layer><Name>ibge:rios</Name><Title>Hidrografia</Title></Layer></Layer></Capability></WMS_Capabilities>`;

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(?:[a-z]\.)?tile\.openstreetmap\.org\/.*/, route => route.abort());
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ json: [
    { descricao: 'IBGE - CCAR', sigla: 'IBGE', wmsAvailable: true, wmsGetCapabilities: 'https://servicos.example/ccar?service=WMS&request=GetCapabilities' },
    { descricao: 'IBGE - BDIA', sigla: 'IBGE', wmsAvailable: true, wmsGetCapabilities: 'https://servicos.example/bdia?service=WMS&request=GetCapabilities' },
    { descricao: 'ANA - Agência Nacional de Águas', sigla: 'ANA', wmsAvailable: true, wmsGetCapabilities: 'https://servicos.example/ana?service=WMS&request=GetCapabilities' },
    { descricao: 'Sem WMS', sigla: 'OUTRO', wmsAvailable: false }
  ] }));
  await page.route('https://servicos.example/**', route => route.fulfill({ contentType: 'text/xml', body: capabilities }));
});

test('seleciona catálogo na lista única e lista somente ao clicar', async ({ page }) => {
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await expect(page.getByLabel('Instituição', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cartografia', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Sem WMS' })).toHaveCount(0);
});

test('busca por título ou nome e diferencia ausência de resultados', async ({ page }) => {
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toBeVisible();
  await page.getByLabel('Buscar camadas').fill('MUNICIPIOS');
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar camadas').fill('ibge:rios');
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toBeVisible();
  await page.getByLabel('Buscar camadas').fill('inexistente');
  await expect(page.getByText('Nenhuma camada encontrada para esta busca.', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar camadas').fill('');
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toBeVisible();
});

test('informa XML inválido e permite tentar novamente', async ({ page }) => {
  await page.route('https://servicos.example/ccar?**', route => route.fulfill({ contentType: 'text/xml', body: '<html>Indisponível</html>' }));
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('documento WMS válido');
  await page.route('https://servicos.example/ccar?**', route => route.fulfill({ contentType: 'text/xml', body: capabilities }));
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Hidrografia', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('distingue catálogo vazio de erro e aceita capabilities WMS 1.1.1', async ({ page }) => {
  await page.route('https://servicos.example/bdia?**', route => route.fulfill({ contentType: 'text/xml', body: '<WMT_MS_Capabilities version="1.1.1"><Capability><Layer><Title>Dados</Title></Layer></Capability></WMT_MS_Capabilities>' }));
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - BDIA' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByText('Este catálogo não possui camadas disponíveis.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('informa falha HTTP mesmo quando a tentativa pelo proxy falha', async ({ page }) => {
  await page.route('https://servicos.example/**', route => route.fulfill({ status: 503, body: 'Indisponível' }));
  await page.route('**/api/get?**', route => route.fulfill({ status: 503, body: 'Indisponível' }));
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar as camadas');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
});

test('mostra falha na lista de catálogos e recupera com nova tentativa', async ({ page }) => {
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ status: 502, body: 'Indisponível' }));
  await page.goto('/visualizador/ol');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os catálogos');
  await expect(page.getByLabel('Catálogo')).toBeDisabled();
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ json: [{ descricao: 'IBGE - CCAR', sigla: 'IBGE', wmsGetCapabilities: 'https://servicos.example/ccar?service=WMS' }] }));
  await page.getByRole('button', { name: 'Tentar novamente' }).click();

  await expect(page.getByLabel('Catálogo').getByRole('option', { name: 'IBGE - CCAR' })).toHaveCount(1);
});

test('descarta resposta antiga ao trocar de catálogo durante carregamento', async ({ page }) => {
  let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  await page.route('https://servicos.example/ccar?**', async route => { await espera; await route.fulfill({ contentType: 'text/xml', body: capabilities }); });
  await page.route('https://servicos.example/bdia?**', route => route.fulfill({ contentType: 'text/xml', body: capabilities.replace('Municípios brasileiros', 'Biomas brasileiros').replace('ibge:municipios', 'ibge:biomas') }));
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByText('Carregando camadas…', { exact: true })).toBeVisible();
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - BDIA' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biomas brasileiros', exact: true })).toBeVisible();
  liberar();
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Biomas brasileiros', exact: true })).toBeVisible();
  await page.getByLabel('Catálogo').selectOption('');
  await expect(page.getByLabel('Catálogo')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Biomas brasileiros', exact: true })).toHaveCount(0);
});

test('mantém controles acessíveis em tela de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/visualizador/ol');

  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/descoberta-celular.png', fullPage: true });
});
