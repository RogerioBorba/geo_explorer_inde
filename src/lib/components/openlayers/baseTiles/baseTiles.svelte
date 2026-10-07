<script>
    import {mapper_ol } from '#lib/shared/openlayers/shared.svelte.ts';   
    import {FacadeOL} from '#lib/components/openlayers/facade_openlayers.ts';
    import { onMount } from 'svelte';
    let camadaEscolhida = 'osm';

    /**
     * @param {{ currentTarget: { value: any; }; }} event
     */
    function onChangeBaseLayer(event) {
        const baseLayerName = event.currentTarget.value
        if (!mapper_ol.facadeOL) return ;
        mapper_ol.facadeOL.setBaseLayer(baseLayerName)
    }

    onMount(async () => {
        if (!mapper_ol.facadeOL) 
         mapper_ol.facadeOL = new FacadeOL();  
    });

</script>
<div class="flex flex-col text-justify text-sm pl-4 whitespace-nowrap" >
    <div class="mt-1">
        <input  type=radio bind:group={camadaEscolhida} value='none' on:change={onChangeBaseLayer}>
        Sem camada base
    </div>
    <div class="mt-1">
        <input type=radio bind:group={camadaEscolhida} value='osm' on:change={onChangeBaseLayer}>
        Camada base Openstreetmap
    </div>
    <div class="mt-1">
        <input type=radio bind:group={camadaEscolhida} value='esriworldstreet' on:change={onChangeBaseLayer}>
        Esri World Street
    </div>
</div> 