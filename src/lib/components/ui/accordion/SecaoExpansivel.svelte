<script lang="ts">
  import { Accordion } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { untrack, type Snippet } from 'svelte';
  let { titulo, aberta = true, children, acoes }: { titulo: string; aberta?: boolean; children: Snippet; acoes?: Snippet } = $props();
  let value = $state(untrack(() => aberta ? 'conteudo' : ''));
</script>

<Accordion.Root type="single" bind:value>
  <Accordion.Item value="conteudo" class="border-b border-slate-200">
    <div class="flex items-center gap-1">
      <Accordion.Header class="min-w-0 flex-1">
        <Accordion.Trigger class="group flex w-full items-center justify-between gap-2 rounded py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700">
          <span class="min-w-0 break-words">{titulo}</span><ChevronDown size={16} class="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      {@render acoes?.()}
    </div>
    <Accordion.Content class="overflow-hidden pb-3">{@render children()}</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
