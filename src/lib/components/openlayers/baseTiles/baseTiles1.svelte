<script lang="ts">
    import { mapper_ol } from '$lib/shared/openlayers/shared.svelte';
    import { onMount } from 'svelte';
    import TileLayer from 'ol/layer/Tile.js';
    import XYZ from 'ol/source/XYZ.js';
    import OSM from 'ol/source/OSM.js';

    let currentBaseId: string | null = $state(null);
    let camadaEscolhida = $state('osm');

    // Dicionário de camadas base disponíveis
    const baseLayers: Record<string, TileLayer<any>> = {
        'osm': new TileLayer({
            source: new OSM(),
            visible: false,
            properties: { id: 'osm', isBase: true }
        }),
        'esri_world_street': new TileLayer({
            source: new XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC'
            }),
            visible: false,
            properties: { id: 'esri_world_street', isBase: true }
        }),
    };

    // ----------------------------------------------------------------------
    // Adiciona camada base
    // ----------------------------------------------------------------------
    function addBaseLayer(baseId: string) {
        if (!mapper_ol.map) return;
        console.log("Primeira");
        const map = mapper_ol.map;
        if (baseId === 'none'  && currentBaseId) {

            const layer = baseLayers[currentBaseId];
            console.log("entreeieiei");
            const res = mapper_ol.map.removeLayer(layer);   
            console.log(`res: ${res}`)  ;
            layer.setVisible(false);    
            currentBaseId = null;
            return;
        }
        removeBaseLayer();
        const layer = baseLayers[baseId];
        if (!layer) return;

        layer.setVisible(true);
        map.addLayer(layer);
        currentBaseId = baseId;
    }

    // ----------------------------------------------------------------------
    // Remove camada base atual
    // ----------------------------------------------------------------------
    function removeBaseLayer() {
        if (!mapper_ol.map || !currentBaseId) return;
        const map = mapper_ol.map;

        const layers = map.getLayers().getArray();
        const layerToRemove = layers.find(l => l.get('id') === currentBaseId);
        if (layerToRemove) {
            map.removeLayer(layerToRemove);
            layerToRemove.setVisible(false);
        }
        currentBaseId = null;
    }

    // ----------------------------------------------------------------------
    // Evento de troca de camada
    // ----------------------------------------------------------------------
    function onChangeBaseLayer(event: Event) {
        const tileName = (event.currentTarget as HTMLInputElement).value;
        camadaEscolhida = tileName;
        addBaseLayer(tileName);
    }

    // ----------------------------------------------------------------------
    // Ao montar o componente: adiciona OSM como base inicial
    // ----------------------------------------------------------------------
    onMount(() => {
        //const map = mapper_ol.map;
        //if (!map) return;

        // Adiciona OSM como base inicial
        camadaEscolhida = 'osm';
        currentBaseId = 'osm';
        //addBaseLayer('osm');
    });
</script>

<!-- SNIPPET PARA RENDERIZAÇÃO DE OPÇÕES -->
{#snippet camada(titulo: string, valor: string)}
    <div class="mt-1">
        <input
            type="radio"
            bind:group={camadaEscolhida}
            value={valor}
            onchange={onChangeBaseLayer}
        />
        {titulo}
    </div>
{/snippet}

<!-- INTERFACE -->
<div class="flex flex-col text-justify text-sm pl-4 whitespace-nowrap">
    {@render camada('Sem camada base', 'none')}
    {@render camada('Camada base OpenStreetMap', 'osm')}
    {@render camada('Camada base Esri World Street', 'esri_world_street')}
</div>
