<script lang="ts">
    import type { IGeoservicoDescricao } from '$lib/inde';
    import { iWFSFeatureTypes, type IFeatureType } from '$lib/ogc/wfs/wfsCapabilities';
    import { get } from '$lib/request/get';
    import { preventDefault } from '$lib/components/svelte_util/util';
    import { onMount } from 'svelte';
    import WFSCapabilityLayer from './WFSCapabilityLayer.svelte';
    import { hasWFSGetCapabilities, matchesFeatureTypeKeywords, parseSearchTerms, type SearchOperator } from './wfsSearch';

    type Catalog = { id: number; descricao: string; iri: string };
    type Result = { catalog: Catalog; featureType: IFeatureType };

    let catalogs = $state<Catalog[]>([]);
    let selectedCatalogs = $state<Catalog[]>([]);
    let keywords = $state('');
    let operator = $state<SearchOperator>('OR');
    let results = $state<Result[]>([]);
    let processed = $state(0);
    let processing = $state(false);
    let feedback = $state('');
    let loadingCatalogs = $state(true);
    const allSelected = $derived(catalogs.length > 0 && selectedCatalogs.length === catalogs.length);

    async function searchCatalog(catalog: Catalog, terms: string[]): Promise<Result[]> {
        try {
            const response = await get(catalog.iri);
            const featureTypes = iWFSFeatureTypes(await response.text());
            return featureTypes
                .filter((featureType) => featureType.name && matchesFeatureTypeKeywords(featureType, terms, operator))
                .map((featureType) => ({ catalog, featureType }));
        } finally {
            processed += 1;
        }
    }

    async function search() {
        feedback = '';
        const terms = parseSearchTerms(keywords);
        if (selectedCatalogs.length === 0) return void (feedback = 'Escolha pelo menos um catálogo.');
        if (terms.length === 0) return void (feedback = 'Informe ao menos uma palavra-chave.');
        processing = true;
        processed = 0;
        results = [];
        try {
            const settled = await Promise.allSettled(selectedCatalogs.map((catalog) => searchCatalog(catalog, terms)));
            results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
            const failures = settled.filter((result) => result.status === 'rejected').length;
            if (failures) feedback = `${failures} catálogo(s) não puderam ser processados.`;
            else if (!results.length) feedback = 'Nenhuma feição encontrada para as palavras-chave informadas.';
        } finally {
            processing = false;
        }
    }

    onMount(async () => {
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
</script>

<form class="relative m-0 text-sm" onsubmit={preventDefault(search)}>
    <label class="mb-3 flex items-center gap-2">
        <input class="rounded border-gray-300" type="checkbox" checked={allSelected} onchange={() => selectedCatalogs = allSelected ? [] : [...catalogs]} />
        Selecionar todos os catálogos
    </label>
    <select size="6" multiple class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 focus:outline-none" bind:value={selectedCatalogs}>
        {#each catalogs as catalog}<option value={catalog}>{catalog.descricao}</option>{/each}
    </select>
    {#if loadingCatalogs}<p class="mt-2 text-center text-blue-600 animate-pulse">Carregando instituições...</p>{/if}
    <textarea class="mt-3 w-full rounded-lg border border-gray-300 p-2 focus:outline-none" rows="4" bind:value={keywords}
        placeholder="Informe uma palavra-chave por linha ou separadas por vírgula"></textarea>
    <div class="mt-3 flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2"><input type="radio" bind:group={operator} value="OR" /> OU entre palavras</label>
        <label class="flex items-center gap-2"><input type="radio" bind:group={operator} value="AND" /> E entre palavras</label>
        <button class="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300" disabled={processing}>Buscar feições</button>
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
