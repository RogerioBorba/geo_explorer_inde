<script lang="ts">
    import type { WFSLayerOL } from '$lib/components/openlayers/layerOL';
    import { preventDefault, stopPropagation } from '$lib/components/svelte_util/util';
    import { layerManager, mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    let {layerOL} = $props<{layerOL: WFSLayerOL}>();
 
    function btnClearClicked() {
        if (!layerOL)
            return 
        layerManager.selectedLayers = layerManager.selectedLayers.filter(t => t.id !== layerOL.id);
        mapper_ol.facadeOL?.removeWFSLayerOL(layerOL);

    }
    


    function viewMetadata(metadataURL: string) {
         window.open(metadataURL, '_blank', 'noopener,noreferrer');
        
    }
    
        
</script>
    <div class="flex  relative text-gray-700">
        {@render titulo()}
        {@render metadados()}
        {@render removerCamada()}
    </div>
    
    {#snippet titulo()}
        <p class="mt-1 flex-grow text-grey-darkest hover:bg-red truncate text-left text-xs" title="{`${layerOL.title}`}">{`${layerOL.title}`}</p>
    {/snippet}
    {#snippet metadados()}
       {#if layerOL.metadata }
            <button
                type="button"
                class="p-1 text-gray-600 hover:bg-gray-200 rounded-full"
                title="Visualizar Metadado"
                onclick={() => viewMetadata(layerOL.metadata.href)}
                aria-label="Visualizar metadado"
            >
                <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" fill="#FCF3CF" viewBox="0 0 24 24" >
                    <path stroke="#1C2833" stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            </button>
            {/if} 
    {/snippet}
    
    {#snippet removerCamada()}
        <button class="mb-2 focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold py-1 px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={stopPropagation(btnClearClicked)} title="Remover camada">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
        </button>
    {/snippet}
    