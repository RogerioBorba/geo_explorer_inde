<script lang="ts">
    import type { IGeoservicoDescricao } from '$lib/inde';
    import type { IWMSLayer, IWMSMetadataURL } from '$lib/ogc/wms/wmsCapabilities';
    import { iWMSCapabilities } from '$lib/ogc/wms/wmsCapabilities';
    import { get } from '$lib/request/get';
    import { preventDefault } from '$lib/components/svelte_util/util';
    import { layerManager, mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    import { WMSLayerOL } from '../layerOL';
    import { onMount } from 'svelte';

    type CatalogOption = { id: number; descricao: string; iri: string };
    type SearchOperator = 'OR' | 'AND';
    type SearchResult = {
        catalog: CatalogOption;
        layer: IWMSLayer;
        capabilitiesUrl: string;
    };

    let catalogOptions = $state<CatalogOption[]>([]);
    let selectedCatalogs = $state<CatalogOption[]>([]);
    let keywordsInput = $state('');
    let searchOperator = $state<SearchOperator>('OR');
    let results = $state<SearchResult[]>([]);
    let processedCatalogCount = $state(0);
    let isProcessing = $state(false);
    let feedbackMessage = $state('');

    const allCatalogsSelected = $derived(
        catalogOptions.length > 0 && selectedCatalogs.length === catalogOptions.length
    );

    const searchTerms = $derived.by(() =>
        keywordsInput
            .split(/[\n,;]+/)
            .map((term) => normalize(term))
            .filter(Boolean)
    );

    function normalize(value: string): string {
        return value.trim().toLowerCase();
    }

    function newCatalogOption(obj: IGeoservicoDescricao, index: number): CatalogOption {
        return { id: index, descricao: obj.descricao, iri: obj.wmsGetCapabilities };
    }

    function hasWMSAvailable(catalog: IGeoservicoDescricao & { wmsAvailable?: boolean }): boolean {
        return Boolean(catalog.wmsAvalaible ?? catalog.wmsAvailable);
    }

    function flattenLayers(layers: IWMSLayer[]): IWMSLayer[] {
        const flattened: IWMSLayer[] = [];

        function visit(layer: IWMSLayer) {
            flattened.push(layer);
            for (const child of layer.layers ?? []) {
                visit(child);
            }
        }

        for (const layer of layers) {
            visit(layer);
        }

        return flattened;
    }

    function matchesLayerKeywords(layer: IWMSLayer, terms: string[], operator: SearchOperator): boolean {
        const normalizedKeywords = (layer.keywords ?? []).map(normalize).filter(Boolean);
        if (normalizedKeywords.length === 0) return false;

        const predicate = (term: string) => normalizedKeywords.some((keyword) => keyword.includes(term));
        return operator === 'AND' ? terms.every(predicate) : terms.some(predicate);
    }

    async function fetchMatchesForCatalog(catalog: CatalogOption): Promise<SearchResult[]> {
        try {
            const response = await get(catalog.iri);
            const xmlText = await response.text();
            const layers = iWMSCapabilities(xmlText).capability.layers;
            const matchedLayers = flattenLayers(layers).filter((layer) => {
                const hasName = layer.name !== undefined && layer.name.trim().length > 0;
                return hasName && matchesLayerKeywords(layer, searchTerms, searchOperator);
            });

            return matchedLayers.map((layer) => ({
                catalog,
                layer,
                capabilitiesUrl: catalog.iri
            }));
        } finally {
            processedCatalogCount += 1;
        }
    }

    async function btnSearchClicked() {
        feedbackMessage = '';

        if (selectedCatalogs.length === 0) {
            feedbackMessage = 'Escolha pelo menos um catalogo.';
            return;
        }

        if (searchTerms.length === 0) {
            feedbackMessage = 'Informe ao menos uma palavra-chave.';
            return;
        }

        isProcessing = true;
        processedCatalogCount = 0;
        results = [];

        try {
            const settled = await Promise.allSettled(selectedCatalogs.map((catalog) => fetchMatchesForCatalog(catalog)));
            results = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);

            const failedCount = settled.filter((item) => item.status === 'rejected').length;
            if (failedCount > 0) {
                feedbackMessage = `${failedCount} catalogo(s) nao puderam ser processados.`;
            } else if (results.length === 0) {
                feedbackMessage = 'Nenhuma camada encontrada para os termos informados.';
            }
        } finally {
            isProcessing = false;
        }
    }

    function toggleAllCatalogs() {
        selectedCatalogs = allCatalogsSelected ? [] : [...catalogOptions];
    }

    function addLayerToMap(result: SearchResult) {
        if (!mapper_ol.facadeOL?.map || !result.layer.name) {
            alert('Mapa nao inicializado ou camada sem nome.');
            return;
        }

        const url = result.capabilitiesUrl.split('?')[0];
        const layerExists = layerManager.selectedLayers.some(
            (layer) => layer.name === result.layer.name && layer.url === url
        );
        if (layerExists) {
            alert(`A camada ${result.layer.name} ja foi carregada.`);
            return;
        }

        const wmsLayerOL: WMSLayerOL = mapper_ol.facadeOL.addWMSLayer(result.layer, url);
        layerManager.selectedLayers.push(wmsLayerOL);
    }

    function viewMetadata(layer: IWMSLayer) {
        const metadataUrl: IWMSMetadataURL = layer.metadataURLs?.[0];
        if (!metadataUrl) {
            alert('Nenhuma URL de metadado encontrada para esta camada.');
            return;
        }

        const viewerUrl = `/visualizador/metadata?link=${encodeURIComponent(metadataUrl.href)}`;
        window.open(viewerUrl, '_blank', 'noopener,noreferrer');
    }

    onMount(async () => {
        try {
            const response = await fetch('/api/inde/catalogos-servicos');
            const data: IGeoservicoDescricao[] = await response.json();
            catalogOptions = data
                .filter((catalog) => hasWMSAvailable(catalog) && catalog.wmsGetCapabilities)
                .map((catalog, index) => newCatalogOption(catalog, index + 1));
        } catch (error) {
            console.error('Failed to fetch catalogos_servicos:', error);
            feedbackMessage = 'Nao foi possivel carregar os catalogos.';
        }
    });
</script>

<form class="relative m-0 text-sm" onsubmit={preventDefault(btnSearchClicked)}>
    <div class="mb-3 flex items-center gap-2">
        <input
            id="selecionar-todos-wms-keyword"
            class="rounded border-gray-300"
            type="checkbox"
            checked={allCatalogsSelected}
            onchange={toggleAllCatalogs}
        />
        <label for="selecionar-todos-wms-keyword">Selecionar todos os catalogos</label>
    </div>

    <select
        size="6"
        multiple
        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 focus:outline-none"
        bind:value={selectedCatalogs}
    >
        {#each catalogOptions as catalog}
            <option value={catalog}>{catalog.descricao}</option>
        {/each}
    </select>

    <textarea
        class="mt-3 w-full rounded-lg border border-gray-300 p-2 focus:outline-none"
        rows="4"
        bind:value={keywordsInput}
        placeholder="Informe uma palavra-chave por linha ou separadas por virgula"
    ></textarea>

    <div class="mt-3 flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2">
            <input type="radio" bind:group={searchOperator} value="OR" />
            <span>OU entre palavras</span>
        </label>
        <label class="flex items-center gap-2">
            <input type="radio" bind:group={searchOperator} value="AND" />
            <span>E entre palavras</span>
        </label>
        <button
            class="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={isProcessing}
            type="submit"
        >
            Buscar camadas
        </button>
        <span class="text-xs text-gray-600">
            Catalogos processados: {processedCatalogCount}/{selectedCatalogs.length}
        </span>
    </div>

    {#if isProcessing}
        <p class="mt-3 text-center text-blue-600 animate-pulse">Processando catalogos...</p>
    {/if}

    {#if feedbackMessage}
        <p class="mt-3 text-sm text-amber-700">{feedbackMessage}</p>
    {/if}
</form>

<div class="mt-4 space-y-2">
    {#each results as result, index (`${result.catalog.id}-${result.layer.name}-${index}`)}
        <div class="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold text-gray-900">{result.layer.title}</p>
                    <p class="text-xs text-gray-500">{result.catalog.descricao}</p>
                    {#if result.layer.name}
                        <p class="text-xs text-gray-600">Nome: {result.layer.name}</p>
                    {/if}
                </div>
                <div class="flex items-center gap-1">
                    {#if result.layer.metadataURLs && result.layer.metadataURLs.length > 0}
                        <button
                            type="button"
                            class="rounded-full p-1 text-gray-600 hover:bg-gray-200"
                            title="Visualizar metadado"
                            onclick={() => viewMetadata(result.layer)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" fill="#FCF3CF" viewBox="0 0 24 24">
                                <path stroke="#1C2833" stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </button>
                    {/if}
                    <button
                        type="button"
                        class="rounded-full p-1 text-green-600 hover:bg-green-100"
                        title="Adicionar camada ao mapa"
                        onclick={() => addLayerToMap(result)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,16L19.36,10.27L21,9L12,2L3,9L4.63,10.27M12,18.54L4.62,12.81L3,14.07L12,21.07L21,14.07L19.37,12.8L12,18.54Z" />
                        </svg>
                    </button>
                </div>
            </div>

           
        </div>
    {/each}
</div>
