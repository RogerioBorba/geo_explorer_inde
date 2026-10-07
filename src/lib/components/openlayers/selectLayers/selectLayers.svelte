<script lang="ts">
  import { preventDefault } from '$lib/components/svelte_util/util';
  import { layerManager } from '$lib/shared/openlayers/shared.svelte';
  import { flip } from 'svelte/animate';
  import { LayerOL } from '../layerOL';
  
  
  // Estado reativo com TypeScript
  let hovering: number | null = null;


  const drop = (event: DragEvent, target: number): void => {
    if (!event.dataTransfer) return;
    event.dataTransfer.dropEffect = 'move'; 
    const start = parseInt(event.dataTransfer.getData("text/plain"));
    
    // Verificar se os índices são válidos
    if (isNaN(start) || start < 0 || target < 0 || 
      start >= layerManager.selectedLayers.length || 
      target >= layerManager.selectedLayers.length) {
      return;
    }

    const newTracklist: LayerOL[] = [...layerManager.selectedLayers];
    
    console.log('start:', start);
    console.log('target:', target);
    
    if (start < target) {
      newTracklist.splice(target + 1, 0, newTracklist[start]);
      newTracklist.splice(start, 1);
    } else {
      newTracklist.splice(target, 0, newTracklist[start]);
      newTracklist.splice(start + 1, 1);
    }
    
    layerManager.selectedLayers = newTracklist;
    
    // Atualizar z-index das camadas
    for (let i = 0; i < newTracklist.length; i++) {
      const layerOL: LayerOL = newTracklist[i];
      layerOL.layer.setZIndex(i + 1);
    }
    
    hovering = null;
  };

  const dragstart = (event: DragEvent, index: number): void => {
    if (!event.dataTransfer) return;
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnter = (index: number): void => {
    hovering = index;
  };

  const handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };

 
</script>

{#each layerManager.selectedLayers as layerOL, index (layerOL.id)}
  <div class= "border rounded-bl-md active:bg-slate-400 mt-1 px-1" animate:flip
    draggable={true} 
    role="button"
    tabindex="0"
    ondragstart={event => dragstart(event, index)}
    ondrop={preventDefault(event => drop(event, index))}
    ondragover={handleDragOver}
    ondragenter={() => hovering = index}
    class:is-active={hovering === index}>
    {#await import(`./Selected${layerOL.className}.svelte`) then Module}
                  <Module.default layerOL={layerOL} />
    {/await}
  </div>
{/each}

<style>
  .is-active {
    --tw-bg-opacity: 1;
    background-color: rgb(148 163 184 / var(--tw-bg-opacity));
    color: #fff;
  }
</style>


