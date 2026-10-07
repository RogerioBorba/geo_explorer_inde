import { test, expect } from '@playwright/test';

const xml = `<WMS_Capabilities version="1.3.0"><Capability><Layer><Title>Serviço</Title><CRS>EPSG:3857</CRS><Layer><Title>Publicação 2022</Title><Layer><Title>Divisão territorial</Title><Layer><Name>municipios</Name><Title>Municípios</Title></Layer></Layer></Layer><Layer><Name>rios</Name><Title>Rios</Title></Layer></Layer></Capability></WMS_Capabilities>`;
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(?:[a-z]\.)?tile\.openstreetmap\.org\/.*/, route => route.abort());
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ json: [{ descricao: 'IBGE - CGMAT', wmsGetCapabilities: 'https://servicos.example/arvore' }] }));
  await page.route('https://servicos.example/arvore', route => route.fulfill({ contentType: 'text/xml', body: xml }));
});

test('preserva agrupamentos recursivos e busca mostra ancestrais dos resultados', async ({ page }) => {
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CGMAT' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Camadas WMS', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rios', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Publicação 2022', exact: true }).click();
  await page.getByRole('button', { name: 'Divisão territorial', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar Publicação 2022 ao mapa' })).toHaveCount(0);
  await page.getByLabel('Buscar camadas').fill('municipios');
  await expect(page.getByRole('button', { name: 'Publicação 2022', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rios', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/arvore-wms-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/arvore-wms-celular.png', fullPage: true });
});

test('recolhe painel e seções pelo teclado sem perder catálogo ou busca', async ({ page }) => {
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CGMAT' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByLabel('Buscar camadas').fill('rios');
  const mapa = page.getByRole('region', { name: 'Área do mapa', exact: true });
  const antes = (await mapa.boundingBox())!.width;
  await page.getByRole('button', { name: 'Esconder painel', exact: true }).click();
  await expect(page.getByLabel('Catálogo')).not.toBeVisible();
  await expect.poll(async () => (await mapa.boundingBox())!.width).toBeGreaterThan(antes);
  await page.getByRole('button', { name: 'Mostrar painel', exact: true }).click();
  await expect(page.getByLabel('Buscar camadas')).toHaveValue('rios');
  const wms = page.getByRole('button', { name: 'WMS — buscar camadas', exact: true });
  await wms.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Catálogo')).not.toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Buscar camadas')).toHaveValue('rios');
  await expect(page.getByRole('link', { name: 'Voltar para Home', exact: true })).toBeVisible();
});
