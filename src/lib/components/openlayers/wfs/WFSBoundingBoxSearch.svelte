<script lang="ts">
    import type { IGeoservicoDescricao } from '$lib/inde';
    import { iWFSFeatureTypes, type IFeatureType } from '$lib/ogc/wfs/wfsCapabilities';
    import { get } from '$lib/request/get';
    import { preventDefault } from '$lib/components/svelte_util/util';
    import { mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    import { FacadeOL } from '../facade_openlayers';
    import { onDestroy, onMount } from 'svelte';
    import WFSCapabilityLayer from './WFSCapabilityLayer.svelte';
    import { containsBounds, geographicBounds, hasWFSGetCapabilities, isValidGeographicBounds, type GeographicBounds } from './wfsSearch';

    type Catalog = { id: number; descricao: string; iri: string };
    type Result = { catalog: Catalog; featureType: IFeatureType };
    type DrawnBounds = {
        westBoundLongitude: number; southBoundLatitude: number;
        eastBoundLongitude: number; northBoundLatitude: number;
    };
    let catalogs = $state<Catalog[]>([]);
    let selectedCatalogs = $state<Catalog[]>([]);
    let west = $state('-74'); let south = $state('-34'); let east = $state('-34'); let north = $state('6');
    let results = $state<Result[]>([]);
    let processed = $state(0); let processing = $state(false); let drawing = $state(false); let feedback = $state('');
    let loadingCatalogs = $state(true);
    const allSelected = $derived(catalogs.length > 0 && selectedCatalogs.length === catalogs.length);

    function enteredBounds(): GeographicBounds {
        const parse = (value: string) => Number(value.trim().replace(',', '.'));
        return { west: parse(west), south: parse(south), east: parse(east), north: parse(north) };
    }
    async function searchCatalog(catalog: Catalog, searchBounds: GeographicBounds): Promise<Result[]> {
        try {
            const response = await get(catalog.iri);
            return iWFSFeatureTypes(await response.text()).flatMap((featureType) => {
                const bounds = geographicBounds(featureType.bbox);
                return featureType.name && bounds && containsBounds(searchBounds, bounds) ? [{ catalog, featureType }] : [];
            });
        } finally { processed += 1; }
    }
    async function search() {
        feedback = '';
        if (!selectedCatalogs.length) return void (feedback = 'Escolha pelo menos um catálogo.');
        const bounds = enteredBounds();
        if (!isValidGeographicBounds(bounds)) return void (feedback = 'Informe um retângulo válido em coordenadas geográficas.');
        mapper_ol.facadeOL?.addBoundingBoxByCoordinates(bounds.west, bounds.south, bounds.east, bounds.north);
        processing = true; processed = 0; results = [];
        try {
            const settled = await Promise.allSettled(selectedCatalogs.map((catalog) => searchCatalog(catalog, bounds)));
            results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
            const failures = settled.filter((result) => result.status === 'rejected').length;
            if (failures) feedback = `${failures} catálogo(s) não puderam ser processados.`;
            else if (!results.length) feedback = 'Nenhuma feição encontrada para o retângulo informado.';
        } finally { processing = false; }
    }
    function startDrawing() {
        if (!mapper_ol.facadeOL) return;
        drawing = true; feedback = '';
        mapper_ol.facadeOL.startBoundingBoxDraw((bounds: DrawnBounds) => {
            west = String(bounds.westBoundLongitude); south = String(bounds.southBoundLatitude);
            east = String(bounds.eastBoundLongitude); north = String(bounds.northBoundLatitude); drawing = false;
        });
    }
    function stopDrawing() { drawing = false; mapper_ol.facadeOL?.removeDrawInteraction(); }
    function clearRectangle() { stopDrawing(); mapper_ol.facadeOL?.clearBoundingBox(); feedback = ''; }
    onMount(async () => {
        if (!mapper_ol.facadeOL) mapper_ol.facadeOL = new FacadeOL();
        try {
            const response = await fetch('/api/inde/catalogos-servicos');
            const data: IGeoservicoDescricao[] = await response.json();
            catalogs = data.filter(hasWFSGetCapabilities)
                .map((item, index) => ({ id: index + 1, descricao: item.descricao, iri: item.wfsGetCapabilities }));
            if (!catalogs.length) feedback = 'Nenhuma instituição com GetCapabilities WFS foi encontrada.';
        } catch (error) {
            console.error('Falha ao carregar catálogos WFS:', error);
            feedback = 'Não foi possível carregar os catálogos.';
        } finally {
            loadingCatalogs = false;
        }
    });
    onDestroy(stopDrawing);
</script>

<form class="relative m-0 text-sm" onsubmit={preventDefault(search)}>
    <label class="mb-3 flex items-center gap-2"><input class="rounded border-gray-300" type="checkbox" checked={allSelected}
        onchange={() => selectedCatalogs = allSelected ? [] : [...catalogs]} /> Selecionar todos os catálogos</label>
    <select size="6" multiple class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 focus:outline-none" bind:value={selectedCatalogs}>
        {#each catalogs as catalog}<option value={catalog}>{catalog.descricao}</option>{/each}
    </select>
    {#if loadingCatalogs}<p class="mt-2 text-center text-blue-600 animate-pulse">Carregando instituições...</p>{/if}
    <button class="mt-3 w-full rounded px-3 py-2 text-white {drawing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}" type="button"
        onclick={drawing ? stopDrawing : startDrawing}>{drawing ? 'Cancelar desenho' : 'Desenhar retângulo no mapa'}</button>
    {#if drawing}<p class="mt-2 rounded border border-green-200 bg-green-50 px-2 py-1 text-green-800">Clique no mapa, arraste e solte para criar o retângulo.</p>{/if}
    <div class="mt-3 grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1"><span class="text-gray-700">Oeste</span><input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={west} /></label>
        <label class="flex flex-col gap-1"><span class="text-gray-700">Leste</span><input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={east} /></label>
        <label class="flex flex-col gap-1"><span class="text-gray-700">Sul</span><input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={south} /></label>
        <label class="flex flex-col gap-1"><span class="text-gray-700">Norte</span><input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={north} /></label>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-3">
        <button class="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300" disabled={processing}>Buscar feições</button>
        <button class="rounded border border-gray-300 bg-white px-3 py-2 text-gray-800 hover:bg-gray-100" type="button" onclick={clearRectangle}>Limpar retângulo</button>
        <span class="text-xs text-gray-600">Catálogos processados: {processed}/{selectedCatalogs.length}</span>
    </div>
    {#if processing}<p class="mt-3 text-center text-blue-600 animate-pulse">Processando catálogos...</p>{/if}
    {#if feedback}<p class="mt-3 text-sm text-amber-700">{feedback}</p>{/if}
</form>
<div class="mt-4 space-y-2">
    {#each results as result, index (`${result.catalog.id}-${result.featureType.name}`)}
        <div class="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
            <p class="text-xs font-semibold text-gray-500">{result.catalog.descricao}</p>
            <WFSCapabilityLayer iWFSLayer={result.featureType} capabilitiesUrl={result.catalog.iri} id={index} selectedColor="#FFFFFF" />
        </div>
    {/each}
</div>
