<script lang="ts">
  import { onMount } from 'svelte';
  import Map from 'ol/Map';
  import View from 'ol/View';
  import TileLayer from 'ol/layer/Tile';
  import OSM from 'ol/source/OSM';
  import { fromLonLat } from 'ol/proj';
  import ImageLayer from 'ol/layer/Image';
  import ImageWMS from 'ol/source/ImageWMS';
  import { get } from '#lib/request/get';
  import { layerManager, mapper_ol } from '#lib/shared/openlayers/shared.svelte';
  import { removerWMS } from '#lib/shared/openlayers/selecionadas';
  import { WMSLayerOL } from '../layerOL';
  import 'ol/ol.css';
  let target: HTMLDivElement;
  let map = $state.raw<Map | undefined>();
  const layers = new globalThis.Map<string, ImageLayer<ImageWMS>>();
  const requests = new globalThis.Map<string, AbortController>();
  let falhas = $state<Record<string, string>>({});
  const avisos = new globalThis.Map<string, ReturnType<typeof setTimeout>>();
  function limparFalha(id: string) {
    clearTimeout(avisos.get(id)); avisos.delete(id); delete falhas[id];
  }
  function informarFalha(id: string, titulo: string) {
    limparFalha(id);
    falhas[id] = `Não foi possível carregar ${titulo} no mapa.`;
    avisos.set(id, setTimeout(() => { avisos.delete(id); delete falhas[id]; }, 2000));
  }
  let carregadas = $state<Record<string, string>>({});
  onMount(() => {
    map = new Map({ target, layers: [new TileLayer({ source: new OSM() })], view: new View({ center: fromLonLat([-52, -15]), zoom: 4 }) });
    mapper_ol.map = map;
    return () => { for (const timer of avisos.values()) clearTimeout(timer); avisos.clear(); for (const controller of requests.values()) controller.abort(); requests.clear(); mapper_ol.map = null; map?.setTarget(undefined); map?.dispose(); layers.clear(); map = undefined; };
  });
  $effect(() => {
    if (!map) return;
    const ids = new Set(layerManager.selectedLayers.map(entry => entry.id));
    for (const [id, layer] of layers) if (!ids.has(id)) { requests.get(id)?.abort(); requests.delete(id); map.removeLayer(layer); layer.dispose(); layers.delete(id); delete carregadas[id]; }
    for (const entry of layerManager.selectedLayers) {
      if (!(entry instanceof WMSLayerOL) || !entry.wms || !entry.url || layers.has(entry.id)) continue;
      const source = new ImageWMS({ url: entry.url, projection: entry.wms.projection, params: { LAYERS: entry.name, STYLES: entry.wms.style, VERSION: entry.wms.version, FORMAT: entry.wms.format } });
      source.on('imageloadend', () => { if (layers.has(entry.id) && !requests.get(entry.id)?.signal.aborted) carregadas[entry.id] = `Camada ${entry.title} carregada.`; });
      source.setImageLoadFunction((image, url) => {
        requests.get(entry.id)?.abort();
        const controller = new AbortController(); requests.set(entry.id, controller);
        const element = image.getImage() as HTMLImageElement;
        void (async () => {
          let objectUrl: string | undefined;
          try {
            const response = await get(url, { signal: controller.signal });
            if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Resposta cartográfica inválida.');
            objectUrl = URL.createObjectURL(await response.blob());
            element.src = objectUrl;
            await element.decode();
            if (!controller.signal.aborted) limparFalha(entry.id);
          } catch {
            if (!controller.signal.aborted) { informarFalha(entry.id, entry.title); element.dispatchEvent(new Event('error')); removerWMS(entry.id); }
          } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
        })();
      });
      const layer = new ImageLayer({ source });
      layers.set(entry.id, layer);
      map.addLayer(layer);
    }
  });
</script>
<div bind:this={target} class="h-full min-h-80 w-full" role="region" aria-label="Mapa do Brasil"></div>
{#if Object.keys(falhas).length}<div role="alert" class="absolute bottom-8 left-3 right-3 rounded bg-white/95 p-3 text-sm text-red-800 shadow">{Object.values(falhas).join(' ')}</div>{/if}
<p role="status" class="sr-only">{Object.values(carregadas).join(' ')}</p>
