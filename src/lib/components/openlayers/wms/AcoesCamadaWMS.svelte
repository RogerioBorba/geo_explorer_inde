<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Layers2 from '@lucide/svelte/icons/layers-2';
  import type { IWMSLayer } from '#lib/ogc/wms/wmsCapabilities';
  import { urlDoMetadado } from '#lib/metadata/link';
  let { camada, adicionada, adicionar }: { camada: IWMSLayer; adicionada: boolean; adicionar: (camada: IWMSLayer) => void } = $props();
</script>
{#if camada.name}
  {#if camada.metadataURLs[0]?.href}<a href={urlDoMetadado(camada.metadataURLs[0].href)} target="_blank" rel="noopener noreferrer" aria-label={`Metadados de ${camada.title}`} title="Abrir metadados" class="rounded p-2 text-teal-800 hover:bg-teal-50"><BookOpen size={16} /></a>{/if}
  <button class="rounded p-2 text-teal-800 hover:bg-teal-50 disabled:opacity-40" disabled={adicionada} aria-label={adicionada ? `${camada.title} já adicionada` : `Adicionar ${camada.title} ao mapa`} title="Adicionar ao mapa" onclick={() => adicionar(camada)}><Layers2 size={16} /></button>
{/if}
