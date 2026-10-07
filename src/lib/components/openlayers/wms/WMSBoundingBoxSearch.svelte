<script lang="ts">
    import type { IGeoservicoDescricao } from '$lib/inde';
    import type { IWMSBoundingBox, IWMSLayer, IWMSMetadataURL } from '$lib/ogc/wms/wmsCapabilities';
    import { iWMSCapabilities } from '$lib/ogc/wms/wmsCapabilities';
    import { get } from '$lib/request/get';
    import { preventDefault } from '$lib/components/svelte_util/util';
    import { layerManager, mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    import { WMSLayerOL } from '../layerOL';
    import { FacadeOL } from '../facade_openlayers';
    import { onDestroy, onMount } from 'svelte';

    type CatalogOption = { id: number; descricao: string; iri: string };
    type GeographicBounds = { west: number; south: number; east: number; north: number };
    type SearchResult = {
        catalog: CatalogOption;
        layer: IWMSLayer;
        capabilitiesUrl: string;
        bounds: GeographicBounds;
    };

    let catalogOptions = $state<CatalogOption[]>([]);
    let selectedCatalogs = $state<CatalogOption[]>([]);
    let west = $state('-74.0');
    let south = $state('-34.0');
    let east = $state('-34.0');
    let north = $state('6.0');
    let results = $state<SearchResult[]>([]);
    let processedCatalogCount = $state(0);
    let isProcessing = $state(false);
    let feedbackMessage = $state('');
    let drawing = $state(false);

    const allCatalogsSelected = $derived(
        catalogOptions.length > 0 && selectedCatalogs.length === catalogOptions.length
    );

    function newCatalogOption(obj: IGeoservicoDescricao, index: number): CatalogOption {
        return { id: index, descricao: obj.descricao, iri: obj.wmsGetCapabilities };
    }

    function hasWMSAvailable(catalog: IGeoservicoDescricao & { wmsAvailable?: boolean }): boolean {
        return Boolean(catalog.wmsAvalaible ?? catalog.wmsAvailable);
    }

    function parseCoordinate(value: string): number {
        return Number(value.trim().replace(',', '.'));
    }

    function isValidLongitude(value: number): boolean {
        return value >= -180 && value <= 180;
    }

    function isValidLatitude(value: number): boolean {
        return value >= -90 && value <= 90;
    }

    function validateCoordinates() {
        const bounds = {
            west: parseCoordinate(west),
            south: parseCoordinate(south),
            east: parseCoordinate(east),
            north: parseCoordinate(north)
        };

        if (Object.values(bounds).some((value) => Number.isNaN(value))) {
            return { error: 'Informe apenas valores numericos.', bounds };
        }

        if (!isValidLongitude(bounds.west) || !isValidLongitude(bounds.east)) {
            return { error: 'Longitude deve estar entre -180 e 180.', bounds };
        }

        if (!isValidLatitude(bounds.south) || !isValidLatitude(bounds.north)) {
            return { error: 'Latitude deve estar entre -90 e 90.', bounds };
        }

        if (bounds.west >= bounds.east) {
            return { error: 'Oeste deve ser menor que leste.', bounds };
        }

        if (bounds.south >= bounds.north) {
            return { error: 'Sul deve ser menor que norte.', bounds };
        }

        return { error: '', bounds };
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

    function hasValidBounds(bounds: GeographicBounds): boolean {
        return [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite)
            && isValidLongitude(bounds.west)
            && isValidLongitude(bounds.east)
            && isValidLatitude(bounds.south)
            && isValidLatitude(bounds.north)
            && bounds.west < bounds.east
            && bounds.south < bounds.north;
    }

    function normalizeCrs(value: string): string {
        return value.trim().toUpperCase();
    }

    function geographicBoundsFromWMSBox(box: IWMSBoundingBox): GeographicBounds | null {
        const crs = normalizeCrs(box.crs);

        if (crs === 'CRS:84') {
            const normalBounds = {
                west: box.minx,
                south: box.miny,
                east: box.maxx,
                north: box.maxy
            };

            if (hasValidBounds(normalBounds)) return normalBounds;
        }

        if (crs === 'EPSG:4326') {
            const axisOrderBounds = {
                west: box.miny,
                south: box.minx,
                east: box.maxy,
                north: box.maxx
            };

            if (hasValidBounds(axisOrderBounds)) return axisOrderBounds;

            const normalBounds = {
                west: box.minx,
                south: box.miny,
                east: box.maxx,
                north: box.maxy
            };

            if (hasValidBounds(normalBounds)) return normalBounds;
        }

        return null;
    }

    function geographicBoundsFromLayer(layer: IWMSLayer): GeographicBounds | null {
        if (layer.geographicBoundingBox && hasValidBounds(layer.geographicBoundingBox)) {
            return layer.geographicBoundingBox;
        }

        for (const box of layer.bbox ?? []) {
            const bounds = geographicBoundsFromWMSBox(box);
            if (bounds) return bounds;
        }

        return null;
    }

    function contains(searchBounds: GeographicBounds, layerBounds: GeographicBounds): boolean {
        return layerBounds.west >= searchBounds.west
            && layerBounds.east <= searchBounds.east
            && layerBounds.south >= searchBounds.south
            && layerBounds.north <= searchBounds.north;
    }

    async function fetchMatchesForCatalog(catalog: CatalogOption, searchBounds: GeographicBounds): Promise<SearchResult[]> {
        try {
            const response = await get(catalog.iri);
            const xmlText = await response.text();
            const layers = iWMSCapabilities(xmlText).capability.layers;
            const matchedLayers = flattenLayers(layers).flatMap((layer) => {
                const hasName = layer.name !== undefined && layer.name.trim().length > 0;
                if (!hasName) return [];

                const bounds = geographicBoundsFromLayer(layer);
                if (!bounds || !contains(searchBounds, bounds)) return [];

                return [{
                    catalog,
                    layer,
                    capabilitiesUrl: catalog.iri,
                    bounds
                }];
            });

            return matchedLayers;
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

        const validation = validateCoordinates();
        if (validation.error) {
            feedbackMessage = validation.error;
            return;
        }

        mapper_ol.facadeOL?.addBoundingBoxByCoordinates(
            validation.bounds.west,
            validation.bounds.south,
            validation.bounds.east,
            validation.bounds.north
        );

        isProcessing = true;
        processedCatalogCount = 0;
        results = [];

        try {
            const settled = await Promise.allSettled(
                selectedCatalogs.map((catalog) => fetchMatchesForCatalog(catalog, validation.bounds))
            );
            results = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);

            const failedCount = settled.filter((item) => item.status === 'rejected').length;
            if (failedCount > 0) {
                feedbackMessage = `${failedCount} catalogo(s) nao puderam ser processados.`;
            } else if (results.length === 0) {
                feedbackMessage = 'Nenhuma camada encontrada para o retangulo informado.';
            }
        } finally {
            isProcessing = false;
        }
    }

    function toggleAllCatalogs() {
        selectedCatalogs = allCatalogsSelected ? [] : [...catalogOptions];
    }

    function formatCoordinate(value: number): string {
        return value.toFixed(6).replace(/\.?0+$/, '');
    }

    function startDrawing() {
        if (!mapper_ol.facadeOL) return;

        feedbackMessage = '';
        drawing = true;
        mapper_ol.facadeOL.startBoundingBoxDraw((bounds) => {
            west = formatCoordinate(bounds.westBoundLongitude);
            south = formatCoordinate(bounds.southBoundLatitude);
            east = formatCoordinate(bounds.eastBoundLongitude);
            north = formatCoordinate(bounds.northBoundLatitude);
            drawing = false;
        });
    }

    function stopDrawing() {
        drawing = false;
        mapper_ol.facadeOL?.removeDrawInteraction();
    }

    function clearBoundingBox() {
        feedbackMessage = '';
        stopDrawing();
        mapper_ol.facadeOL?.clearBoundingBox();
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
        if (!mapper_ol.facadeOL) {
            mapper_ol.facadeOL = new FacadeOL();
        }

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

    onDestroy(() => {
        stopDrawing();
    });
</script>

<form class="relative m-0 text-sm" onsubmit={preventDefault(btnSearchClicked)}>
    <div class="mb-3 flex items-center gap-2">
        <input
            id="selecionar-todos-wms-bbox"
            class="rounded border-gray-300"
            type="checkbox"
            checked={allCatalogsSelected}
            onchange={toggleAllCatalogs}
        />
        <label for="selecionar-todos-wms-bbox">Selecionar todos os catalogos</label>
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

    <div class="mt-3 space-y-2">
        <button
            class="w-full rounded px-3 py-2 text-white {drawing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}"
            type="button"
            onclick={drawing ? stopDrawing : startDrawing}
        >
            {drawing ? 'Cancelar desenho' : 'Desenhar retangulo no mapa'}
        </button>

        {#if drawing}
            <p class="rounded border border-green-200 bg-green-50 px-2 py-1 text-green-800">
                Clique no mapa, arraste e solte para criar o retangulo.
            </p>
        {/if}
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1">
            <span class="text-gray-700">Oeste</span>
            <input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={west} />
        </label>

        <label class="flex flex-col gap-1">
            <span class="text-gray-700">Leste</span>
            <input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={east} />
        </label>

        <label class="flex flex-col gap-1">
            <span class="text-gray-700">Sul</span>
            <input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={south} />
        </label>

        <label class="flex flex-col gap-1">
            <span class="text-gray-700">Norte</span>
            <input class="w-full rounded border border-gray-300 px-2 py-1" type="text" inputmode="decimal" bind:value={north} />
        </label>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
            class="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={isProcessing}
            type="submit"
        >
            Buscar camadas
        </button>
        <button
            class="rounded border border-gray-300 bg-white px-3 py-2 text-gray-800 hover:bg-gray-100"
            type="button"
            onclick={clearBoundingBox}
        >
            Limpar retangulo
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
                    {#if result.layer.name}
                        <p class="text-xs text-gray-600">Nome: {result.layer.name}</p>
                    {/if}
                    <p class="text-xs text-gray-500">{result.catalog.descricao}</p>
                    
                    
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
