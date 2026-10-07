<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import ChartNoAxesColumn from '@lucide/svelte/icons/chart-no-axes-column';
  import X from '@lucide/svelte/icons/x';
  import type { WMSLayerOL } from '../layerOL';
  import { removerWMS } from '#lib/shared/openlayers/selecionadas';
  import { urlDoMetadado } from '#lib/metadata/link';
  let { entry }: { entry: WMSLayerOL } = $props();
  let legendaAberta = $state(false);
  let erroLegenda = $state(false);
</script>
<div class="border-b border-slate-200 py-2">
  <div class="flex items-center gap-1">
    <div class="min-w-0 flex-1"><p class="text-sm text-slate-800">{entry.title}</p><p class="truncate text-xs text-slate-500" title={entry.wms?.origem}>{entry.wms?.origem}</p></div>
    {#if entry.metadata?.href}<a href={urlDoMetadado(entry.metadata.href)} target="_blank" rel="noopener noreferrer" aria-label={`Metadados de ${entry.title}`} title="Abrir metadados" class="rounded p-2 text-teal-800 hover:bg-teal-50"><BookOpen size={16} /></a>{/if}
    <button aria-label={`Legenda de ${entry.title}`} aria-expanded={legendaAberta} title="Abrir legenda" class="rounded p-2 text-teal-800 hover:bg-teal-50" onclick={() => { legendaAberta = !legendaAberta; erroLegenda = false; }}><ChartNoAxesColumn size={16} /></button>
    <button aria-label={`Remover ${entry.title} do mapa`} title="Remover camada" class="rounded p-2 text-slate-600 hover:bg-slate-100" onclick={() => removerWMS(entry.id)}><X size={16} /></button>
  </div>
  {#if legendaAberta}
    {#if !entry.wms?.legenda}<p role="status" class="mt-2 text-sm text-slate-500">Legenda não disponível.</p>
    {:else if erroLegenda}<p role="status" class="mt-2 text-sm text-slate-500">Não foi possível carregar a legenda.</p>
    {:else}<img src={entry.wms.legenda} alt={`Legenda de ${entry.title}`} class="mt-3 max-w-full" onerror={() => erroLegenda = true} />{/if}
  {/if}
</div>
