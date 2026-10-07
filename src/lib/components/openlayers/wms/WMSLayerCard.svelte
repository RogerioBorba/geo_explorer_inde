<script lang="ts">
    import type { IWMSStyle } from "$lib/ogc/wms/wmsCapabilities";

    let {wmsLayer} = $props();
    let metadados = $state(wmsLayer.metadataURLs);

    function stylesAsString() {
        if (!wmsLayer.styles)
            return ''
        return wmsLayer.styles.map( (st: IWMSStyle) => st.title).toString()
    }
    function keywordsString() {
        return (wmsLayer.keywords)? wmsLayer.keywords.toString(): 'Não há palavras chaves'
    }
    
    function crssAsString() {
        if (!wmsLayer.crs)
            return ''
        return wmsLayer.crs.toString()
    }
    
</script>
    <div class="font-semibold p-2 bg-gray-200  text-gray-800 rounded-md shadow-sm hover:shadow-md flex flex-col break-words text-sm text-left">
        <h2> <span >Nome:</span> {wmsLayer.name || wmsLayer.title}</h2>
        <h2> <span >Título:</span> {wmsLayer.title}</h2>
        <h2> <span >Palavras chaves: </span>{keywordsString()}</h2>
        <h2> <span >Estilo:</span> {stylesAsString()}</h2>
        <h2> <span >CRSs:</span> {crssAsString()}</h2>
       <!-- <h2><a class= "text-blue-500 underline underline-offset-4" href={wmsLayer.style().legendGraphic().link()}>Link legenda</a></h2> -->
        {#if metadados }
            {#each metadados as metadata}
                <p>
                   <a class="text-xs text-blue-500 underline underline-offset-4 uppercase" href="/metadado?link={encodeURIComponent(metadata.href)}" target="_blank">Metadado</a>
                   <span> tipo: {metadata.type}</span>
                </p>
            {/each}
        {:else}
            <span class="text-xs text-yellow-500 uppercase">Sem metadado associado</span>
        {/if}
</div>
