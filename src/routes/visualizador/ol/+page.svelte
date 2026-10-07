<script lang="ts">
  import { onMount } from 'svelte';
  import Mapa from '#lib/components/openlayers/map/MapaExplorador.svelte';
  import { catalogosWMS, type CatalogoWMS } from '#lib/inde/catalogos.ts';
  import { lerCapabilities, camadasDoDocumento, filtrarCamadas, filtrarArvoreWMS, type CamadaDescoberta } from '#lib/ogc/wms/descoberta.ts';
  import type { IWMSCapabilities, IWMSLayer } from '#lib/ogc/wms/wmsCapabilities';
  import { layerManager } from '#lib/shared/openlayers/shared.svelte';
  import { adicionarWMS } from '#lib/shared/openlayers/selecionadas';
  import { WMSLayerOL } from '#lib/components/openlayers/layerOL';
  import CamadaSelecionada from '#lib/components/openlayers/selectLayers/CamadaSelecionada.svelte';
  import ArvoreWMS from '#lib/components/openlayers/wms/ArvoreWMS.svelte';
  import SecaoExpansivel from '#lib/components/ui/accordion/SecaoExpansivel.svelte';
  import { get } from '#lib/request/get.ts';
  let catalogos = $state<CatalogoWMS[]>([]);
  let catalogoId = $state('');
  let camadas = $state<CamadaDescoberta[]>([]);
  let carregandoCatalogos = $state(true);
  let carregandoCamadas = $state(false);
  let erroCatalogos = $state('');
  let erroCamadas = $state('');
  let carregado = $state(false);
  let busca = $state('');
  let painelAberto = $state(true);
  const filtradas = $derived(filtrarCamadas(camadas, busca));
  const escolhido = $derived(catalogos.find(item => item.id === catalogoId));
  let catalogController: AbortController | undefined;
  let requestId = 0;
  let layerController: AbortController | undefined;
  let documento = $state.raw<IWMSCapabilities | undefined>();
  const raizes = $derived(documento?.capability.layers ?? []);
  const arvore = $derived(filtrarArvoreWMS(raizes.length === 1 && !raizes[0].name ? raizes[0].layers : raizes, busca));
  let erroInclusao = $state('');
  const selecionadas = $derived(layerManager.selectedLayers.filter((entry): entry is WMSLayerOL => entry instanceof WMSLayerOL && !!entry.wms));
  function adicionar(camada: CamadaDescoberta) {
    erroInclusao = '';
    if (!documento || !escolhido) return;
    try { adicionarWMS(camada, documento, escolhido); } catch (error) { erroInclusao = error instanceof Error ? error.message : 'Não foi possível adicionar a camada.'; }
  }
  function adicionarModelo(modelo: IWMSLayer) { const camada = camadas.find(item => item.nome === modelo.name); if (camada) adicionar(camada); }
  function adicionadaNome(nome: string) { return selecionadas.some(entry => entry.wms?.serviceId === escolhido?.capabilitiesUrl && entry.name === nome); }
  async function carregarCatalogos() {
    catalogController?.abort();
    const controller = new AbortController();
    catalogController = controller;
    carregandoCatalogos = true;
    erroCatalogos = '';
    try {
      const response = await fetch('/api/inde/catalogos-servicos/ibge', { signal: controller.signal });
      if (!response.ok) throw new Error('Não foi possível carregar os catálogos.');
      catalogos = catalogosWMS(await response.json());
    } catch (error) {
      if (!controller.signal.aborted) erroCatalogos = error instanceof Error ? error.message : 'Não foi possível carregar os catálogos.';
    } finally { if (!controller.signal.aborted) carregandoCatalogos = false; }
  }
  function limparCamadas() {
    layerController?.abort();
    requestId++;
    camadas = [];
    documento = undefined;
    erroInclusao = '';
    busca = '';
    erroCamadas = '';
    carregandoCamadas = false;
    carregado = false;
  }
  async function carregarCamadas() {
    limparCamadas();
    if (!escolhido) return;
    const catalogo = escolhido;
    const controller = new AbortController();
    layerController = controller;
    const id = requestId;
    carregandoCamadas = true;
    try {
      const response = await get(catalogo.capabilitiesUrl, { signal: controller.signal });
      const parsed = lerCapabilities(await response.text(), catalogo.capabilitiesUrl);
      if (id === requestId) { documento = parsed; camadas = camadasDoDocumento(parsed); carregado = true; }
    } catch (error) {
      if (id === requestId) erroCamadas = error instanceof Error ? error.message : 'Não foi possível listar as camadas.';
    } finally { if (id === requestId) carregandoCamadas = false; }
  }
  onMount(() => {
    void carregarCatalogos();
    return () => { requestId++; catalogController?.abort(); layerController?.abort(); };
  });
</script>
<svelte:head><title>Explorar camadas WMS | Geo_Explorer_INDE</title></svelte:head>
<div class="relative h-dvh bg-slate-50 text-slate-900">
  <main class="flex h-full">
    <aside id="painel-camadas" class="absolute inset-y-0 left-0 z-20 w-[min(380px,100vw)] overflow-y-auto border-r border-slate-200 bg-white p-4 md:relative md:shrink-0" class:hidden={!painelAberto} aria-label="Descoberta de camadas">
      <div class="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
        <a href="/" aria-label="Voltar para Home" class="rounded px-2 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50">Home</a>
        <button aria-label="Esconder painel" aria-controls="painel-camadas" aria-expanded={painelAberto} onclick={() => painelAberto = false} class="rounded px-3 py-1 text-xl hover:bg-slate-100">×</button>
      </div>
      <h1 class="sr-only">Explorar camadas</h1>
      <SecaoExpansivel titulo="WMS — buscar camadas">
      <p class="mt-2 text-sm text-slate-600">Escolha um catálogo e liste suas camadas WMS.</p>
      {#if carregandoCatalogos}<p role="status" class="mt-4">Carregando catálogos…</p>
      {:else if erroCatalogos}<div role="alert" class="mt-4 text-red-700">{erroCatalogos}</div><button class="mt-2 rounded bg-teal-800 px-3 py-2 text-white" onclick={carregarCatalogos}>Tentar novamente</button>
      {:else if !catalogos.length}<p role="status" class="mt-4">Nenhum catálogo WMS disponível.</p>{/if}
      <label for="catalogo" class="mt-4 block text-sm font-medium">Catálogo</label>
      <select id="catalogo" class="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3" bind:value={catalogoId} disabled={carregandoCatalogos || !!erroCatalogos} onchange={limparCamadas}>
        <option value="">Escolha um catálogo</option>
        {#each catalogos as item}<option value={item.id}>{item.titulo}</option>{/each}
      </select>
      <button class="mt-3 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={!escolhido || carregandoCamadas} onclick={carregarCamadas}>Listar camadas</button>
      {#if carregandoCamadas}<p role="status" class="mt-5">Carregando camadas…</p>
      {:else if erroCamadas}<div role="alert" class="mt-5"><p class="font-medium text-red-700">Não foi possível carregar as camadas.</p><p class="mt-1 break-words text-sm text-slate-600">{erroCamadas}</p></div><button class="mt-3 rounded bg-teal-800 px-3 py-2 text-white" onclick={carregarCamadas}>Tentar novamente</button>
      {:else if carregado && !camadas.length}<p role="status" class="mt-5">Este catálogo não possui camadas disponíveis.</p>
      {:else if !escolhido}<p class="mt-5 text-sm text-slate-500">As camadas aparecerão aqui após a escolha do catálogo.</p>{/if}
      {#if carregado && camadas.length}
        <label for="busca" class="mt-5 block text-sm font-medium">Buscar camadas</label>
        <input id="busca" class="mt-2 w-full rounded-lg border border-slate-300 p-3" type="search" placeholder="Título ou nome da camada" bind:value={busca} />
        <p role="status" class="mt-2 text-xs text-slate-500">{filtradas.length} de {camadas.length} camadas</p>
        {#if !filtradas.length}<p role="status" class="mt-4 text-sm">Nenhuma camada encontrada para esta busca.</p>{/if}
      {/if}
      <div class="mt-4">{#key busca}<ArvoreWMS raiz camadas={arvore} {busca} adicionar={adicionarModelo} adicionada={adicionadaNome} />{/key}</div>
      {#if erroInclusao}<p role="alert" class="mt-3 text-sm text-red-700">{erroInclusao}</p>{/if}
      </SecaoExpansivel>
      <section aria-label="Camadas selecionadas" class="mt-2">
        <SecaoExpansivel titulo="Camadas selecionadas">
        {#if !selecionadas.length}<p class="mt-2 text-sm text-slate-500">Nenhuma camada adicionada.</p>{/if}
        {#each selecionadas as entry (entry.id)}
          <CamadaSelecionada {entry} />
        {/each}
        </SecaoExpansivel>
      </section>
    </aside>
    <section class="relative h-full min-w-0 flex-1" aria-label="Área do mapa">
      {#if !painelAberto}<button aria-label="Mostrar painel" aria-controls="painel-camadas" aria-expanded={painelAberto} onclick={() => painelAberto = true} class="absolute left-12 top-3 z-10 rounded bg-white px-3 py-2 text-sm font-medium text-teal-800 shadow">Mostrar painel</button>{/if}
      <Mapa />
    </section>
  </main>
</div>
