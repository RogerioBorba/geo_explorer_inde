<script lang="ts">
    import type { IGeoservicoDescricao } from '$lib/inde';
    import type {IWMSLayer} from '$lib/ogc/wms/wmsCapabilities';
    import {iWMSLayers} from '$lib/ogc/wms/wmsCapabilities';
    import {get} from '$lib/request/get';
    import { error } from '@sveltejs/kit';
    import { onMount } from 'svelte';
    import WMSTreeView from './WMSTreeView.svelte';
    let promise = $state<undefined | null | Promise<number>| number>(null);
    type IDTEXTIRI = { id: number; text: string; iri: string };
    const firstIDTextIRIObj: IDTEXTIRI = { id: 1, text: "Escolha um catálogo", iri: '' }; //: Record<{id: number, text:string, iri: string}> 
    let selectedIDTextIRI = $state(firstIDTextIRIObj);
    let i = 1;
    let iriArray = $state<IDTEXTIRI[]>([]);
    let wmsLayers = $state<IWMSLayer[]>([]); 
    let answer = $state('');
    let textEntered = $state("");
    let wmsLayersFiltered = $derived.by(() => {
        let result: IWMSLayer[] = [];
        if (textEntered && textEntered.length >= 3) {
                result = wmsLayers.filter(
                    (wms_layer: IWMSLayer) => wms_layer.title?.toLowerCase().includes(textEntered.toLowerCase()))
        }
        else {
            result = [...wmsLayers]
        }
        return result;
    });
    //$inspect(wmsLayers);
    function newIRI(obj: IGeoservicoDescricao) {
        return { id: i++, text: obj.descricao, iri: obj.wmsGetCapabilities }
    }
    
    async function fetchListWMSLayer(): Promise<number> {
        const resp =  await get(selectedIDTextIRI.iri);
        const xmlString: string = await resp.text();
        if(!xmlString) throw error(500, `Não foi possível realizar a requisição: ${selectedIDTextIRI.iri}`);
        wmsLayers = iWMSLayers(xmlString, selectedIDTextIRI.iri);
        //console.log(wmsLayers);
        return wmsLayers.length;
    }

    async function btnSearchClicked() {
         if(!selectedIDTextIRI.iri) {
            let msg = "Escolha o endereço (URL) ou informe um CSW Capabilities de uma instituição."
            console.log(msg)
            return 
        }  
        try {
            promise = fetchListWMSLayer();           
        } catch (error) {
            promise = 1;
            throw error
        }     
    };

    function btnClearClicked() {
        selectedIDTextIRI = firstIDTextIRIObj;
        promise = 1;
        wmsLayers = [];
        wmsLayersFiltered = [];
        textEntered = "" ;  
    }

	function handleSubmit() {
		alert(`answered question ${selectedIDTextIRI.id} (${selectedIDTextIRI.text}) with "${answer}"`);
	};

    function preventDefault(fn: (event: Event) => void) {
        return function (this: HTMLElement, event: Event) {
            event.preventDefault();
            fn.call(this, event);
        };
    };     
    
    onMount(async() => {
        try {
            const response = await fetch("/api/inde/catalogos-servicos/ibge");
            const data: any[] = await response.json(); // better: replace any[] with actual type
            iriArray = [selectedIDTextIRI].concat(
                data.map((catalogoGeoInde: IGeoservicoDescricao) => newIRI(catalogoGeoInde))
            );
        } catch (error) {
            console.error('Failed to fetch catalogos_servicos:', error);
        }
    })
    
</script>


<form class="relative m-0" onsubmit={preventDefault(handleSubmit)}>
	<select class="shadow-sm p-2 text-sm w-full rounded-lg bg-white border-gray-300 focus:outline-none text-gray-500" 
    bind:value={selectedIDTextIRI}>
		{#each iriArray as iri}
			<option value={iri}>
				{iri.text}
			</option>
		{/each}
	</select>
    <div class="flex mt-4 relative text-gray-700">
        <input class="w-full p-2 text-sm shadow-sm border-gray-300 rounded-lg focus:outline-none" placeholder="URL WMS GetCapabilities" type="text" bind:value={selectedIDTextIRI.iri} title={selectedIDTextIRI.iri}>
        <button class="focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(btnSearchClicked)} title="Buscar camadas">
            <svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="20" height="20" viewBox="0 0 24 24"><path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" /></svg>
        </button>
        <button class="focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold  px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(btnClearClicked)} title="Limpar camadas">
            <svg style="width:20px;height:20px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2M14.59,8L12,10.59L9.41,8L8,9.41L10.59,12L8,14.59L9.41,16L12,13.41L14.59,16L16,14.59L13.41,12L16,9.41L14.59,8Z" />
            </svg>  
        </button>    
    </div> 
    {#await promise}
        <p class = "text-xl text-center text-blue-600 animate-pulse">...aguarde</p>
    {:then layers}
       {#if layers == 0}
            <p class="text-blue-800 text-lg p-1">Não há camadas!</p>
        {:else if layers == -1}
        <p class="text-red-800 text-lg p-1">Problema no xml retornado do GetCapabilities</p>
        {/if}    
       <input class="w-full h-8 pl-3 pr-8 text-base placeholder-gray-600 border rounded-lg focus: outline-none" hidden={wmsLayers.length == 0 ?true:false} type="text" placeholder="Digite para filtrar" bind:value={textEntered} title="Filtro">
    {#each wmsLayersFiltered as layer}
         <WMSTreeView iWMSLayer={layer} capabilitiesUrl={selectedIDTextIRI.iri}></WMSTreeView>
    {/each}    
    {:catch error}
        <p class="text-red-500 text-xl ">{error.message}</p>
    {/await} 
</form>
