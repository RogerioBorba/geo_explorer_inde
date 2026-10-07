<script lang="ts">
  import { onDestroy } from 'svelte';
  import type MapBrowserEvent from 'ol/MapBrowserEvent';
  import type { EventsKey } from 'ol/events';
  import ImageWMS from 'ol/source/ImageWMS';
  import { unByKey } from 'ol/Observable';
  import { get } from '$lib/request/get';
  import type { WFSLayerOL, WMSLayerOL } from '$lib/components/openlayers/layerOL';
  import { layerManager, mapper_ol } from '$lib/shared/openlayers/shared.svelte';

  type PropertyValue = string | number | boolean | null;

  type FeatureResult = {
    id?: string;
    properties: Record<string, PropertyValue>;
  };

  type LayerResult = {
    layerId: string;
    layerName: string;
    layerTitle: string;
    features: FeatureResult[];
    error?: string;
  };

  let active = $state(false);
  let loading = $state(false);
  let message = $state('Ative a ferramenta e clique sobre uma camada WMS ou WFS visível.');
  let results = $state<LayerResult[]>([]);
  let clickKey: EventsKey | null = null;
  let requestNumber = 0;

  function wmsLayers(): WMSLayerOL[] {
    return layerManager.selectedLayers.filter((entry): entry is WMSLayerOL =>
      entry.type === 'WMS' && Boolean(entry.layer?.getVisible?.())
    );
  }

  function wfsLayers(): WFSLayerOL[] {
    return layerManager.selectedLayers.filter((entry): entry is WFSLayerOL =>
      entry.type === 'WFS' && Boolean(entry.layer?.getVisible?.())
    );
  }

  function scalar(value: unknown): PropertyValue {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return value as PropertyValue;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function parseFeatureInfo(payload: unknown): FeatureResult[] {
    if (!payload || typeof payload !== 'object') return [];

    const value = payload as Record<string, unknown>;
    const rawFeatures = Array.isArray(value.features)
      ? value.features
      : value.type === 'Feature'
        ? [value]
        : [];

    return rawFeatures.map((rawFeature) => {
      const feature = rawFeature as Record<string, unknown>;
      const rawProperties = feature.properties && typeof feature.properties === 'object'
        ? feature.properties as Record<string, unknown>
        : {};

      return {
        id: feature.id === undefined ? undefined : String(feature.id),
        properties: Object.fromEntries(
          Object.entries(rawProperties).map(([key, property]) => [key, scalar(property)])
        )
      };
    });
  }

  function parseWFSFeature(feature: unknown): FeatureResult {
    const candidate = feature as {
      getId?: () => string | number | undefined;
      getProperties?: () => Record<string, unknown>;
      getGeometryName?: () => string;
    };
    const geometryName = candidate.getGeometryName?.() ?? 'geometry';
    const properties = candidate.getProperties?.() ?? {};
    const displayProperties = Object.fromEntries(
      Object.entries(properties)
        .filter(([key]) => key !== geometryName)
        .map(([key, value]) => [key, scalar(value)])
    );

    return {
      id: candidate.getId?.() === undefined ? undefined : String(candidate.getId?.()),
      properties: displayProperties
    };
  }

  function queryWFSLayer(layer: WFSLayerOL, event: MapBrowserEvent): LayerResult {
    const mapLayer = layer.layer;
    if (!mapLayer) {
      return {
        layerId: layer.id,
        layerName: layer.name,
        layerTitle: layer.title,
        features: [],
        error: 'A camada WFS não está disponível no mapa.'
      };
    }

    const features = event.map.getFeaturesAtPixel(event.pixel, {
      hitTolerance: 5,
      layerFilter: (candidate) => candidate === mapLayer
    });

    return {
      layerId: layer.id,
      layerName: layer.name,
      layerTitle: layer.title,
      features: features.map(parseWFSFeature)
    };
  }

  async function queryWMSLayer(
    layer: WMSLayerOL,
    event: MapBrowserEvent
  ): Promise<LayerResult> {
    const source = layer.layer?.getSource?.();
    const view = event.map.getView();
    const resolution = view.getResolution();

    if (!(source instanceof ImageWMS) || resolution === undefined) {
      return {
        layerId: layer.id,
        layerName: layer.name,
        layerTitle: layer.title,
        features: [],
        error: 'A fonte desta camada não permite a consulta GetFeatureInfo.'
      };
    }

    const requestUrl = source.getFeatureInfoUrl(
      event.coordinate,
      resolution,
      view.getProjection(),
      { INFO_FORMAT: 'application/json', FEATURE_COUNT: 10 }
    );

    if (!requestUrl) {
      return {
        layerId: layer.id,
        layerName: layer.name,
        layerTitle: layer.title,
        features: [],
        error: 'Não foi possível montar a requisição GetFeatureInfo.'
      };
    }

    try {
      const response = await get(requestUrl, {
        headers: { Accept: 'application/json' },
        timeout: 30000
      });
      const text = await response.text();
      let payload: unknown;

      try {
        payload = JSON.parse(text);
      } catch {
        const xmlMessage = new DOMParser()
          .parseFromString(text, 'text/xml')
          .querySelector('ServiceException, ExceptionText')
          ?.textContent?.trim();
        throw new Error(xmlMessage || 'O serviço não retornou informações em formato JSON.');
      }

      return {
        layerId: layer.id,
        layerName: layer.name,
        layerTitle: layer.title,
        features: parseFeatureInfo(payload)
      };
    } catch (error) {
      return {
        layerId: layer.id,
        layerName: layer.name,
        layerTitle: layer.title,
        features: [],
        error: error instanceof Error ? error.message : 'Falha ao consultar a camada.'
      };
    }
  }

  async function handleMapClick(event: MapBrowserEvent) {
    const currentRequest = ++requestNumber;
    const visibleWMSLayers = wmsLayers();
    const visibleWFSLayers = wfsLayers();
    results = [];

    if (visibleWMSLayers.length === 0 && visibleWFSLayers.length === 0) {
      message = 'Adicione e deixe visível ao menos uma camada WMS ou WFS para consultar.';
      return;
    }

    loading = true;
    message = 'Consultando as camadas WMS e WFS visíveis…';
    const wfsResults = visibleWFSLayers.map((layer) => queryWFSLayer(layer, event));
    const wmsResults = await Promise.all(
      visibleWMSLayers.map((layer) => queryWMSLayer(layer, event))
    );
    const queryResults = [...wfsResults, ...wmsResults];

    if (currentRequest !== requestNumber) return;

    results = queryResults;
    loading = false;
    const featureCount = queryResults.reduce((total, result) => total + result.features.length, 0);
    message = featureCount > 0
      ? `${featureCount} feição${featureCount === 1 ? '' : 'ões'} encontrada${featureCount === 1 ? '' : 's'}.`
      : 'Nenhuma feição foi encontrada nesse ponto.';
  }

  function deactivate() {
    active = false;
    requestNumber += 1;
    loading = false;
    if (clickKey) {
      unByKey(clickKey);
      clickKey = null;
    }

    const target = mapper_ol.facadeOL?.map.getTargetElement();
    if (target) target.style.cursor = '';
  }

  function toggle() {
    if (active) {
      deactivate();
      message = 'Ative a ferramenta e clique sobre uma camada WMS ou WFS visível.';
      return;
    }

    const map = mapper_ol.facadeOL?.map;
    if (!map) {
      message = 'O mapa ainda não está disponível.';
      return;
    }

    active = true;
    message = 'Clique no mapa para consultar as camadas WMS e WFS visíveis.';
    map.getTargetElement().style.cursor = 'crosshair';
    clickKey = map.on('singleclick', handleMapClick);
  }

  onDestroy(deactivate);
</script>

<section class="space-y-3 px-3 py-2 text-sm" aria-live="polite">
  <p class="text-gray-700">
    Consulte os atributos das feições WMS e WFS no ponto selecionado do mapa.
  </p>

  <button
    type="button"
    class="w-full rounded px-3 py-2 font-semibold text-white transition-colors {active ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}"
    aria-pressed={active}
    onclick={toggle}
  >
    {active ? 'Desativar informação da camada' : 'Ativar informação da camada'}
  </button>

  <p class="rounded bg-gray-100 p-2 text-xs text-gray-700" class:animate-pulse={loading}>
    {message}
  </p>

  {#each results as result (result.layerId)}
    <article class="overflow-hidden rounded border border-gray-200 bg-white">
      <h3 class="border-b border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-gray-800">
        {result.layerTitle}
      </h3>

      {#if result.error}
        <p class="p-2 text-xs text-red-700">{result.error}</p>
      {:else if result.features.length === 0}
        <p class="p-2 text-xs text-gray-500">Nenhuma feição nesta camada.</p>
      {:else}
        {#each result.features as feature, index}
          <div class="border-b border-gray-100 p-2 last:border-b-0">
            <h4 class="mb-1 text-xs font-semibold text-gray-700">
              Feição {index + 1}{feature.id ? ` — ${feature.id}` : ''}
            </h4>
            <dl class="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-2 gap-y-1 text-xs">
              {#each Object.entries(feature.properties) as [key, value]}
                <dt class="break-words font-medium text-gray-600">{key}</dt>
                <dd class="break-all text-gray-800">{value ?? '—'}</dd>
              {/each}
            </dl>
          </div>
        {/each}
      {/if}
    </article>
  {/each}
</section>
