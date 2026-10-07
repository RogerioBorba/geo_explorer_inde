<script lang="ts">
    import { page } from '$app/state';
    import MetadataViewer from '#lib/components/metadata/MetadataViewer.svelte';
</script>
<MetadataViewer sourceLink={page.url.searchParams.get('link') ?? ''} backUrl="/visualizador/ol" backLabel="Voltar ao visualizador" />
