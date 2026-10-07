<script lang="ts">
  import { onMount } from 'svelte';
  import {mapper_ol} from '#lib/shared/openlayers/shared.svelte'
  import { FacadeOL } from '../facade_openlayers';

  onMount(async () => {
    if (!mapper_ol.facadeOL) 
          mapper_ol.facadeOL = new FacadeOL();  
  });

</script>
<div id="id_map" class="fixed top-0 left-0 inset-0  w-screen h-screen z-0 bg-white/50" aria-hidden="true" ></div>

<style>
  :global(body) { height: 100%; margin: 0; }

  /* mover attribution para canto inferior direito (mais específico e com !important) */
  :global(.ol-control.ol-attribution),
  :global(.ol-attribution.ol-control),
  :global(.ol-attribution) {
    top: auto !important;
    bottom: 0.5rem !important;
    left: auto !important;
    right: 0.5rem !important;
  }

  /* cobre variação compact (mobile) */
  :global(.ol-attribution.ol-compact) {
    top: auto !important;
    bottom: 0.5rem !important;
    right: 0.5rem !important;
  }

  /* tamanho do texto */
  :global(.ol-attribution, .ol-attribution .ol-attribution-qualified) {
    font-size: 0.75rem !important;
  }
</style>