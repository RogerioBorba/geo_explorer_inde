import { test, expect } from '@playwright/test';

const xml = `<WMS_Capabilities version="1.3.0" xmlns:xlink="http://www.w3.org/1999/xlink"><Capability><Request><GetMap><Format>image/png</Format><DCPType><HTTP><Get><OnlineResource xlink:href="https://servicos.example/mapa"/></Get></HTTP></DCPType></GetMap></Request><Layer><Title>Dados</Title><CRS>EPSG:3857</CRS><Style><Name>padrao</Name><Title>Padrão</Title><LegendURL><Format>image/png</Format><OnlineResource xlink:href="https://servicos.example/legenda.png"/></LegendURL></Style><Layer><Name>municipios</Name><Title>Municípios</Title><MetadataURL type="TC211"><Format>text/html</Format><OnlineResource xlink:href="/metadados/municipios"/></MetadataURL></Layer><Layer><Name>rios</Name><Title>Rios</Title></Layer></Layer></Capability></WMS_Capabilities>`;
const xmlComLegenda = xml.replace('</GetMap></Request>', '</GetMap><GetLegendGraphic><Format>image/png</Format><DCPType><HTTP><Get><OnlineResource xlink:href="https://servicos.example/legenda"/></Get></HTTP></DCPType></GetLegendGraphic></Request>');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(?:[a-z]\.)?tile\.openstreetmap\.org\/.*/, route => route.abort());
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ json: [
    { descricao: 'IBGE - CCAR', sigla: 'IBGE', wmsGetCapabilities: 'https://servicos.example/capabilities' },
    { descricao: 'IBGE - BDIA', sigla: 'IBGE', wmsGetCapabilities: 'https://servicos.example/outro' }
  ] }));
  await page.route('https://servicos.example/**', route => {
    const url = new URL(route.request().url());
    if (['getmap', 'getlegendgraphic'].includes(url.searchParams.get('REQUEST')?.toLowerCase() ?? '') || url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: png });
    return route.fulfill({ contentType: 'text/xml', body: xmlComLegenda });
  });
});

test('falha GetMap remove a camada selecionada e permite nova tentativa', async ({ page }) => {
  await page.route('https://servicos.example/mapa?**', route => route.fulfill({ status: 503, body: 'Indisponível' }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Área do mapa', exact: true })).toContainText('Não foi possível carregar Municípios no mapa.');
  await expect(page.getByRole('region', { name: 'Camadas selecionadas', exact: true }).getByText('Municípios', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Área do mapa', exact: true }).getByRole('alert')).toHaveCount(0, { timeout: 3500 });
  await page.route('https://servicos.example/mapa?**', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await expect(page.getByText('Camada Municípios carregada.', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Camadas selecionadas', exact: true }).getByText('Municípios', { exact: true })).toBeVisible();
});

test('legenda indisponível mantém seleção e remontagem reconstrói o mapa', async ({ page }) => {
  await page.route('https://servicos.example/legenda?**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Legenda de Municípios', exact: true }).click();
  await expect(page.getByText('Não foi possível carregar a legenda.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Explore os dados geográficos do Brasil', exact: true })).toBeVisible();
  const getMap = page.waitForRequest(request => new URL(request.url()).searchParams.get('REQUEST') === 'GetMap');
  await page.getByRole('link', { name: 'Visualizador', exact: true }).click();
  await getMap;
  await expect(page.getByRole('region', { name: 'Camadas selecionadas', exact: true }).getByText('Municípios', { exact: true })).toBeVisible();
});

test('oferece metadados somente quando anunciados e resolve URL relativa', async ({ page }) => {
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  const metadataUrl = '/metadado?link=https%3A%2F%2Fservicos.example%2Fmetadados%2Fmunicipios';
  await expect(page.getByRole('link', { name: 'Metadados de Municípios', exact: true })).toHaveAttribute('href', metadataUrl);
  await expect(page.getByRole('link', { name: 'Metadados de Rios', exact: true })).toHaveCount(0);
});

test('abre o registro ISO na página de metadados e mantém acesso ao XML original', async ({ page }) => {
  const iso = `<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco"><gmd:fileIdentifier><gco:CharacterString>municipios-2026</gco:CharacterString></gmd:fileIdentifier><gmd:identificationInfo><gmd:MD_DataIdentification><gmd:citation><gmd:CI_Citation><gmd:title><gco:CharacterString>Municípios brasileiros</gco:CharacterString></gmd:title></gmd:CI_Citation></gmd:citation><gmd:abstract><gco:CharacterString>Limites municipais publicados pela instituição.</gco:CharacterString></gmd:abstract><gmd:descriptiveKeywords><gmd:MD_Keywords><gmd:keyword><gco:CharacterString>Limites administrativos</gco:CharacterString></gmd:keyword></gmd:MD_Keywords></gmd:descriptiveKeywords></gmd:MD_DataIdentification></gmd:identificationInfo></gmd:MD_Metadata>`;
  await page.context().route('https://servicos.example/metadados/municipios', route => route.fulfill({ contentType: 'application/xml', body: iso }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  const novaAba = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Metadados de Municípios', exact: true }).click();
  const metadados = await novaAba;
  await expect(metadados).toHaveURL(/\/metadado\?link=/);
  await expect(metadados.getByRole('heading', { name: 'Municípios brasileiros', exact: true })).toBeVisible();
  await expect(metadados.getByText('Limites municipais publicados pela instituição.', { exact: true })).toBeVisible();
  await expect(metadados.getByText('Limites administrativos', { exact: true })).toBeVisible();
  await expect(metadados.getByRole('link', { name: 'XML original', exact: true })).toHaveAttribute('href', 'https://servicos.example/metadados/municipios');
});

test('registro de metadados inválido informa a falha e preserva o endereço original', async ({ page }) => {
  await page.route('https://servicos.example/metadados/municipios', route => route.fulfill({ contentType: 'application/xml', body: '<gmd:MD_Metadata>' }));
  await page.goto('/metadado?link=https%3A%2F%2Fservicos.example%2Fmetadados%2Fmunicipios');
  await expect(page.getByRole('heading', { name: 'Não foi possível abrir o metadado', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir XML original', exact: true })).toHaveAttribute('href', 'https://servicos.example/metadados/municipios');
});

test('adiciona ao mapa e selecionadas, preserva ao trocar catálogo e evita duplicatas', async ({ page }) => {
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  const getMap = page.waitForRequest(request => new URL(request.url()).searchParams.get('REQUEST') === 'GetMap');
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  const request = new URL((await getMap).url());
  expect(request.pathname).toBe('/mapa');
  expect(request.searchParams.get('LAYERS')).toBe('municipios');
  expect(request.searchParams.get('CRS')).toBe('EPSG:3857');
  expect(request.searchParams.get('STYLES')).toBe('');
  const selecionadas = page.getByRole('region', { name: 'Camadas selecionadas', exact: true });
  await expect(selecionadas.getByText('Municípios', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Municípios já adicionada', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Área do mapa', exact: true }).getByText('Camada Municípios carregada.', { exact: true })).toHaveCount(1);
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - BDIA' });
  await expect(selecionadas.getByText('Municípios', { exact: true })).toBeVisible();
});

test('selecionadas oferecem metadados, legenda padrão e remoção sincronizada', async ({ page }) => {
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  const selecionadas = page.getByRole('region', { name: 'Camadas selecionadas', exact: true });
  await expect(selecionadas.getByRole('link', { name: 'Metadados de Municípios', exact: true })).toHaveAttribute('href', '/metadado?link=https%3A%2F%2Fservicos.example%2Fmetadados%2Fmunicipios');
  await selecionadas.getByRole('button', { name: 'Legenda de Municípios', exact: true }).click();
  const legenda = selecionadas.getByRole('img', { name: 'Legenda de Municípios', exact: true });
  await expect(legenda).toHaveAttribute('src', /https:\/\/servicos\.example\/legenda\?/);
  const legendaUrl = new URL(await legenda.getAttribute('src') ?? '');
  expect(legendaUrl.searchParams.get('REQUEST')).toBe('GetLegendGraphic');
  expect(legendaUrl.searchParams.has('STYLE')).toBe(false);
  await expect(selecionadas.getByRole('img', { name: 'Legenda de Municípios', exact: true })).toBeVisible();
  await selecionadas.getByRole('button', { name: 'Remover Municípios do mapa', exact: true }).click();
  await expect(selecionadas.getByText('Municípios', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true })).toBeEnabled();
  await expect(page.getByText('Camada Municípios carregada.', { exact: true })).toHaveCount(0);
});

test('WMS 1.1.1 usa SRS, aceita herança e mantém nomes iguais de serviços distintos', async ({ page }) => {
  const legacy = xml.replace('WMS_Capabilities', 'WMT_MS_Capabilities').replace('/WMS_Capabilities', '/WMT_MS_Capabilities').replace('1.3.0', '1.1.1').replace('<CRS>EPSG:3857</CRS>', '<SRS>EPSG:4326</SRS>');
  await page.route('https://servicos.example/capabilities', route => route.fulfill({ contentType: 'text/xml', body: legacy }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  const getMap = page.waitForRequest(request => new URL(request.url()).searchParams.get('VERSION') === '1.1.1');
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  const url = new URL((await getMap).url());
  expect(url.searchParams.get('SRS')).toBe('EPSG:4326');
  expect(url.searchParams.has('CRS')).toBe(false);
  const bbox = url.searchParams.get('BBOX')!.split(',').map(Number);
  expect(bbox.every(Number.isFinite)).toBe(true); expect(bbox[0]).toBeLessThan(bbox[2]);
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - BDIA' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Camadas selecionadas', exact: true }).getByText('Municípios', { exact: true })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/visualizador-desktop.png', fullPage: true });
});

test('ausência de legenda não impede inclusão e projeção incompatível informa motivo', async ({ page }) => {
  await page.route('https://servicos.example/capabilities', route => route.fulfill({ contentType: 'text/xml', body: xml.replace(/<Style>[\s\S]*?<\/Style>/, '') }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Legenda de Municípios', exact: true }).click();
  await expect(page.getByText('Legenda não disponível.', { exact: true })).toBeVisible();
  await page.route('https://servicos.example/outro', route => route.fulfill({ contentType: 'text/xml', body: xml.replace('EPSG:3857', 'EPSG:99999') }));
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - BDIA' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Rios ao mapa', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('projeção compatível');
});

test('grupo com Name é adicionável e recolher painel preserva selecionadas', async ({ page }) => {
  const grouped = xml.replace('</MetadataURL></Layer>', '</MetadataURL><Layer><Name>distritos</Name><Title>Distritos</Title></Layer></Layer>');
  await page.route('https://servicos.example/capabilities', route => route.fulfill({ contentType: 'text/xml', body: grouped }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  await expect(page.getByText('Camada Municípios carregada.', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Municípios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Distritos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Esconder painel', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar painel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Camadas selecionadas', exact: true }).getByText('Municípios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'WMS — buscar camadas', exact: true }).click();
  await page.screenshot({ path: 'test-results/painel-selecionadas-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Remover Municípios do mapa', exact: true }).click();
  await expect(page.getByText('Camada Municípios carregada.', { exact: true })).toHaveCount(0);
});

test('solicita o estilo padrão sem presumir o primeiro estilo anunciado', async ({ page }) => {
  const ownStyle = `<Style><Name>municipios-proprio</Name><Title>Municípios</Title><LegendURL><Format>image/png</Format><OnlineResource xlink:href="https://servicos.example/propria.png"/></LegendURL></Style>`;
  const capabilities = xml.replace('<Title>Municípios</Title>', `<Title>Municípios</Title>${ownStyle}`);
  await page.route('https://servicos.example/capabilities', route => route.fulfill({ contentType: 'text/xml', body: capabilities }));
  await page.goto('/visualizador/ol');
  await page.getByLabel('Catálogo').selectOption({ label: 'IBGE - CCAR' });
  await page.getByRole('button', { name: 'Listar camadas', exact: true }).click();
  const getMap = page.waitForRequest(request => new URL(request.url()).searchParams.get('REQUEST') === 'GetMap');
  await page.getByRole('button', { name: 'Adicionar Municípios ao mapa', exact: true }).click();
  expect(new URL((await getMap).url()).searchParams.get('STYLES')).toBe('');
  await page.getByRole('button', { name: 'Legenda de Municípios', exact: true }).click();
  await expect(page.getByText('Legenda não disponível.', { exact: true })).toBeVisible();
});
