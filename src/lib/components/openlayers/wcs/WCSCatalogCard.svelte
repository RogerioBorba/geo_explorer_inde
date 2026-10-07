<script lang="ts">
    import { goto } from '$app/navigation';
    import { capabilities, coverageStats, type IWCSCoverageDescription, type ICoverageStats, type IWCSGetCapabilities}from '$lib/ogc/wcs/wcsCapabilities';
    import type { OGCProcessRecord } from '$lib/ogc/commom/OGCRecord';
    import { Spinner } from "flowbite-svelte";
    import { fade } from 'svelte/transition'
    import { onMount } from 'svelte';
    import { get } from "$lib/request/get";
    import { counterWCS } from '$lib/shared/ogc/wcs/shared.svelte';
    
    let ows_capabilities: IWCSGetCapabilities;
    let { objIdDescricaoIri, onRecordCreated }: {objIdDescricaoIri: {id: number, descricao: string, iri: string}, onRecordCreated?: (record: OGCProcessRecord) => void} = $props();
    let tempoRequisicao = $state(0);
    let qtdCobertura = $state(0);
    let qtdCoberturaSemMetadadosAssociado = $state(0);
    let qtdCoberturaSemPalavraChave = $state(0);
    let bgColor = $state('bg-gray-200');
    let spinHidden = $state('');
    let spinMessage = $state('processando ...');
    let requestGetRecordsTextOrError =  $state('Requisição GetCapabilities');
    let showMaisDetalhesHidden = $state('hidden'); 
    
    function linkClicked() {
        counterWCS.currentWCSCapability = ows_capabilities;
        goto("/ogc/wcs/capabilities")
    }

    function initializeVariablesOnMount(coverages: IWCSCoverageDescription[]) {
        const stats: ICoverageStats = coverageStats(coverages);
        qtdCobertura = stats.withIdentifier || 0;
        qtdCoberturaSemMetadadosAssociado = stats.withoutMetadata || 0;
        qtdCoberturaSemPalavraChave = stats.withoutKeywords || 0;
    }
   
    onMount(async () => {
        try {
            if(!objIdDescricaoIri.iri) {
                spinHidden = 'hidden';
                spinMessage = 'Sem catálogo WCS para processamento';
                return;
            }
            const tempo = new Date().getTime();
            const res = await get(objIdDescricaoIri.iri, { timeout: 60000 });
            const xmlText = await res.text();
            ows_capabilities = capabilities(xmlText);
            ows_capabilities.serviceUrl = objIdDescricaoIri.iri;
            const coverages: IWCSCoverageDescription[] = ows_capabilities.summary?.coverages || [];
            initializeVariablesOnMount(coverages);
            tempoRequisicao = parseFloat(((new Date().getTime() - tempo) / 1000).toFixed(2));
            spinHidden = 'hidden';
            spinMessage = 'processado com sucesso';
            showMaisDetalhesHidden = '';
            requestGetRecordsTextOrError = 'Requisição GetCapabilities';
            bgColor = 'bg-gray-200';
            // cria registro tipado
            const record: OGCProcessRecord = {
                id: objIdDescricaoIri.id,
                serviceType: 'WCS',
                operation: 'GetCapabilities',
                datetime: new Date().toISOString(),
                requestTimeSeconds: tempoRequisicao,
                name: objIdDescricaoIri.descricao,
                numLayers: qtdCobertura,
                numLayersWithoutMetadata: qtdCoberturaSemMetadadosAssociado,
                numLayersWithoutKeywords: qtdCoberturaSemPalavraChave,
                url: objIdDescricaoIri.iri,
                processadoSemErro: true
            };
            onRecordCreated?.(record);
        } catch (error: any) {
            requestGetRecordsTextOrError = `ERRO na requisição:  ${objIdDescricaoIri.iri} . ${error.status} - ${error.statusText}. Contate o responsável.`;
            bgColor =  'bg-red-200';
            spinHidden = 'hidden';
            spinMessage = `processado com erro`;
            showMaisDetalhesHidden = 'hidden';
            // cria registro tipado mesmo em caso de erro
            const recordErr: OGCProcessRecord = {
                id: objIdDescricaoIri.id,
                serviceType: 'WCS',
                operation: 'GetCapabilities',
                datetime: new Date().toISOString(),
                requestTimeSeconds: tempoRequisicao,
                name: objIdDescricaoIri.descricao,
                numLayers: qtdCobertura,
                numLayersWithoutMetadata: qtdCoberturaSemMetadadosAssociado,
                numLayersWithoutKeywords: qtdCoberturaSemPalavraChave,
                url: objIdDescricaoIri.iri,
                processadoSemErro: false
            };
            onRecordCreated?.(recordErr);
        }
    });
    
</script>
<div class="p-2 {bgColor} text-sm text-left text-gray-800 rounded-md shadow-sm hover:shadow-md flex flex-col" transition:fade data-qtd-cobertura={qtdCobertura} data-qtd-cobertura-sem-metadado={qtdCoberturaSemMetadadosAssociado}>
    <h2 class="font-semibold">{requestGetRecordsTextOrError}</h2>
    <h2 class="font-semibold">{objIdDescricaoIri.descricao}</h2>
    <h2>Tempo de requisição GetCapabilities: {tempoRequisicao} seg.</h2>
    <h2>Qtd de coberturas: {qtdCobertura}</h2>
    <h2>Qtd de coberturas sem metadado associado: {qtdCoberturaSemMetadadosAssociado}</h2>
    <h2>Qtd de coberturas sem palavras chaves: {qtdCoberturaSemPalavraChave}</h2>
    <button class="{showMaisDetalhesHidden} text-green-600 text-left font-semibold hover:bg-gray-200 hover:underline py-1 hover:cursor-pointer" onclick={linkClicked}>Mais detalhes</button>
    <div class="bg-slate-300 text-slate-600 rounded-md text-center p-1">
        <Spinner class="{spinHidden} mr-3" size="4" color="blue" />
        {spinMessage}
    </div>
</div>
