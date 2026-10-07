<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Navegacao from '#lib/components/Navegacao.svelte';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !page.url.pathname.startsWith('/visualizador/')}<Navegacao />{/if}
{@render children()}
