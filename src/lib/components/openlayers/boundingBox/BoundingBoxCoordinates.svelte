<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { mapper_ol } from '$lib/shared/openlayers/shared.svelte';
  import { FacadeOL } from '$lib/components/openlayers/facade_openlayers';

  let west = '-74.0';
  let south = '-34.0';
  let east = '-34.0';
  let north = '6.0';
  let error = '';
  let drawing = false;

  onMount(() => {
    if (!mapper_ol.facadeOL) {
      mapper_ol.facadeOL = new FacadeOL();
    }
  });

  onDestroy(() => {
    mapper_ol.facadeOL?.removeDrawInteraction();
  });

  function parseCoordinate(value: string): number {
    return Number(value.trim().replace(',', '.'));
  }

  function validateCoordinates() {
    const values = {
      west: parseCoordinate(west),
      south: parseCoordinate(south),
      east: parseCoordinate(east),
      north: parseCoordinate(north)
    };
    
    function isValidLongitude(value: number): boolean {
      return value >= -180 && value <= 180;
    }

    function isValidLatitude(value: number): boolean {
      return value >= -90 && value <= 90;
    } 

    if (Object.values(values).some((value) => Number.isNaN(value))) {
      return { error: 'Informe apenas valores numericos.', values };
    }

    if (!isValidLongitude(values.west) || !isValidLongitude(values.east)) {
      return { error: 'Longitude deve estar entre -180 e 180.', values };
    }

    if (!isValidLatitude(values.south) || !isValidLatitude(values.north)) {
      return { error: 'Latitude deve estar entre -90 e 90.', values };
    }

    if (values.west >= values.east) {
      return { error: 'Oeste deve ser menor que leste.', values };
    }

    if (values.south >= values.north) {
      return { error: 'Sul deve ser menor que norte.', values };
    }

    return { error: '', values };
  }

  function drawBoundingBox() {
    stopDrawing();
    const result = validateCoordinates();
    error = result.error;

    if (error || !mapper_ol.facadeOL) return;

    mapper_ol.facadeOL.addBoundingBoxByCoordinates(
      result.values.west,
      result.values.south,
      result.values.east,
      result.values.north
    );
  }

  function clearBoundingBox() {
    error = '';
    stopDrawing();
    mapper_ol.facadeOL?.clearBoundingBox();
  }

  function formatCoordinate(value: number): string {
    return value.toFixed(6).replace(/\.?0+$/, '');
  }

  function startDrawing() {
    if (!mapper_ol.facadeOL) return;

    error = '';
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
</script>

<form class="space-y-3 px-3 py-2 text-sm" onsubmit={(event) => { event.preventDefault(); drawBoundingBox(); }}>
  <div class="space-y-2">
    <button
      class="w-full rounded px-3 py-2 text-white {drawing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}"
      type="button"
      onclick={drawing ? stopDrawing : startDrawing}
    >
      {drawing ? 'Cancelar desenho' : 'Desenhar no mapa'}
    </button>

    {#if drawing}
      <p class="rounded border border-green-200 bg-green-50 px-2 py-1 text-green-800">
        Clique no mapa e arraste o mouse para desenhar retângulo. Clique novamente para finalizar.
      </p>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-2">
    <label class="flex flex-col gap-1">
      <span class="text-gray-700">Oeste</span>
      <input
        class="w-full rounded border border-gray-300 px-2 py-1"
        type="text"
        inputmode="decimal"
        bind:value={west}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-gray-700">Leste</span>
      <input
        class="w-full rounded border border-gray-300 px-2 py-1"
        type="text"
        inputmode="decimal"
        bind:value={east}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-gray-700">Sul</span>
      <input
        class="w-full rounded border border-gray-300 px-2 py-1"
        type="text"
        inputmode="decimal"
        bind:value={south}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-gray-700">Norte</span>
      <input
        class="w-full rounded border border-gray-300 px-2 py-1"
        type="text"
        inputmode="decimal"
        bind:value={north}
      />
    </label>
  </div>

  {#if error}
    <p class="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">{error}</p>
  {/if}

  <div class="flex gap-2">
    <button class="flex-1 rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700" type="submit">
      Desenhar
    </button>
    <button
      class="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-800 hover:bg-gray-100"
      type="button"
      onclick={clearBoundingBox}
    >
      Limpar
    </button>
  </div>
</form>
