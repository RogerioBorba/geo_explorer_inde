<script lang="ts">
    import type { IWMSLayer, IWMSMetadataURL} from '$lib/ogc/wms/wmsCapabilities';
    import { layerManager, mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    import { WMSLayerOL } from '../layerOL';
    import Self from './WMSTreeView.svelte';
    
    let { iWMSLayer, capabilitiesUrl } = $props<{
        iWMSLayer: IWMSLayer;
        capabilitiesUrl: string;
    }>();
    let expanded = $state(false);
    function addLayerToMap(layer: IWMSLayer) {
       // const map = mapper_ol.facadeOL?.map;
        if (!mapper_ol.facadeOL?.map || !layer.name) {
            alert('Mapa não inicializado ou camada sem nome.');
            return;
        }       

        try {       
            const url: string = capabilitiesUrl.split('?')[0];      
            const layerExiste = layerManager.selectedLayers.some(layer => layer.name === iWMSLayer.name && layer.url === url);
            if (layerExiste) return alert(`A camada ${iWMSLayer.name} já foi carregada`);    
		    let wmsLayerOL: WMSLayerOL =   mapper_ol.facadeOL?.addWMSLayer(iWMSLayer, url);
            layerManager.selectedLayers.push(wmsLayerOL);
        } catch (e: any) {
            console.error('Erro ao adicionar camada WMS:', e);
            alert(`Não foi possível adicionar a camada: ${e?.message ?? e}`);
        }
    }

    function viewMetadata(layer: IWMSLayer) {
        const metadataUrl: IWMSMetadataURL = layer.metadataURLs?.[0];
        if (metadataUrl) {
            const viewerUrl = `/metadado?link=${encodeURIComponent(metadataUrl.href)}`;
            window.open(viewerUrl, '_blank', 'noopener,noreferrer');
        } else {
            alert('Nenhuma URL de metadado encontrada para esta camada.');
        }
    }

    function haCamadas(): boolean {
        return iWMSLayer.layers !== undefined && iWMSLayer.layers.length > 0;
    }   
    function haMetadado(): boolean {
        return iWMSLayer.metadataURLs !== undefined && iWMSLayer.metadataURLs.length > 0;
    }
    function camadaTemNome(): boolean {
        return iWMSLayer.name !== undefined && iWMSLayer.name.trim().length > 0;
    }
</script>

<div class="ml-2 border-l border-gray-200 pl-2">
    <div class="flex items-center justify-between py-1">
        <div class="flex items-center">
            {#if haCamadas()}
                <button
                    type="button"
                    class="mr-1 text-gray-500 p-1 rounded"
                    onclick={() => (expanded = !expanded)}
                    aria-label={expanded ? 'Recolher' : 'Expandir'}
                >
                    <svg class="w-4 h-4 transition-transform" class:rotate-90={expanded} viewBox="0 0 24 24">
                        <path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                    </svg>
                </button>
            {:else}
                <span class="w-4 h-4 mr-1"></span>
            {/if}
            <span class="text-sm text-gray-800">{iWMSLayer.title}</span>
        </div>

        <!-- Botões sempre visíveis; metadado só aparece se existir; incluir aparece somente se layer.name -->
        <div class="flex items-center space-x-1">
            {#if haMetadado()}
                <button
                    type="button"
                    class="p-1 text-gray-600 hover:bg-gray-200 rounded-full"
                    title="Visualizar Metadado"
                    onclick={() => viewMetadata(iWMSLayer)}
                    aria-label="Visualizar metadado"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" fill="#FCF3CF" viewBox="0 0 24 24" >
			            <path stroke="#1C2833" stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
		            </svg>
                </button>
            {/if}

            {#if camadaTemNome()}
                <button
                    type="button"
                    class="p-1 text-green-600 hover:bg-green-200 rounded-full"
                    title="Adicionar camada ao mapa"
                    onclick={() => addLayerToMap(iWMSLayer)}
                    aria-label="Adicionar camada ao mapa"
                >
                    <!-- ícone 'layers' (stack) -->
                    <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12,16L19.36,10.27L21,9L12,2L3,9L4.63,10.27M12,18.54L4.62,12.81L3,14.07L12,21.07L21,14.07L19.37,12.8L12,18.54Z" />
					</svg>
                </button>
			
            {/if}
        </div>
    </div>

    {#if expanded && iWMSLayer.layers}
        <div>
            {#each iWMSLayer.layers as childLayer}
                <Self iWMSLayer={childLayer} {capabilitiesUrl} />
            {/each}
        </div>
    {/if}
</div>
