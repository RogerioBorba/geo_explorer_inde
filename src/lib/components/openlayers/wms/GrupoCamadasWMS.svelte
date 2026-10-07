<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  let { titulo, aberta = false, children, acoes }: { titulo: string; aberta?: boolean; children: Snippet; acoes?: Snippet } = $props();
  let expandido = $state(untrack(() => aberta));
  const id = $props.id();
</script>

<div class="flex items-center gap-1 py-1">
  <button aria-expanded={expandido} aria-controls={id} onclick={() => expandido = !expandido} class="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700">
    <ChevronRight size={14} class={expandido ? 'shrink-0 rotate-90 text-slate-500' : 'shrink-0 text-slate-500'} />
    {#if expandido}<FolderOpen size={16} class="shrink-0 text-teal-700" />{:else}<Folder size={16} class="shrink-0 text-teal-700" />{/if}
    <span class="min-w-0 break-words">{titulo}</span>
  </button>
  {@render acoes?.()}
</div>
<div {id} hidden={!expandido} class="ml-3 border-l border-slate-200 pl-3">{@render children()}</div>
