<script lang="ts">
  import type { IWMSLayer } from '#lib/ogc/wms/wmsCapabilities';
  import GrupoCamadasWMS from './GrupoCamadasWMS.svelte';
  import AcoesCamadaWMS from './AcoesCamadaWMS.svelte';
  import ArvoreWMS from './ArvoreWMS.svelte';
  let { camadas, busca, adicionar, adicionada, raiz = false }: { camadas: IWMSLayer[]; busca: string; adicionar: (camada: IWMSLayer) => void; adicionada: (nome: string) => boolean; raiz?: boolean } = $props();
</script>

<ul aria-label={raiz ? 'Camadas WMS' : undefined} class="m-0 list-none p-0">
{#each camadas as camada}
  <li>
  {#if camada.layers.length}
    <GrupoCamadasWMS titulo={camada.title || 'Grupo de camadas'} aberta={!!busca}>
      {#snippet acoes()}<AcoesCamadaWMS {camada} {adicionar} adicionada={adicionada(camada.name ?? '')} />{/snippet}
      <ArvoreWMS camadas={camada.layers} {busca} {adicionar} {adicionada} />
    </GrupoCamadasWMS>
  {:else if camada.name}
    <article class="flex items-center gap-2 border-b border-slate-100 py-2">
      <h2 class="min-w-0 flex-1 break-words text-sm text-slate-800" title={camada.abstract || camada.name}>{camada.title}</h2>
      <AcoesCamadaWMS {camada} {adicionar} adicionada={adicionada(camada.name)} />
    </article>
  {/if}
  </li>
{/each}
</ul>
