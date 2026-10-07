<script lang="ts">
    import {layerManager, mapper_ol} from '$lib/shared/openlayers/shared.svelte';
    import type { IFeatureType, IMetadataUrl} from '$lib/ogc/wfs/wfsCapabilities';
    import {preventDefault} from '$lib/components/svelte_util/util';
    import { get } from '$lib/request/get';
    //import {metadataLink} from '$lib/store/storeVisualizadorMetadata'
    
    import { Fill, Stroke, Style } from 'ol/style';
    import CircleStyle from 'ol/style/Circle';
    import { onMount } from 'svelte';
    import { onDestroy } from 'svelte';
    
    //import WfsModal from './WFSModal.svelte';
    
    //import {hiddenDraw} from '$lib/store/storeBoudingBox';
    import proj4 from 'proj4'
    import type { FacadeOL } from '../facade_openlayers';
    import { WFSLayer } from './wfsLayer';
    import { featureCounted } from '$lib/ogc/wfs/wfsFeature';
    import type VectorImageLayer from 'ol/layer/VectorImage';
    import  { WFSLayerOL } from '../layerOL';

    let { iWFSLayer, capabilitiesUrl, id, selectedColor  = '#FFFFFF'} = $props<{
        iWFSLayer: IFeatureType,
        capabilitiesUrl: string,
        id: number,
        selectedColor: string
    }>();
    let source = $state(null);
    let sourceLayer = $state(null);
    let display = $state('');
    let visibilytMetadata =$state('visible');
    let featureCount = $state<number | string>(0);
    let color = $state(HTMLInputElement);
    let userColor = $state('');
    let colorInput = $state<HTMLInputElement>();
    let aleatoryColor = $state('');
    let loading = $state(false);
    let removed = $state([]);
    let unsubscribe = $state('');

    let wfsLayer = $state<WFSLayer>(new WFSLayer(iWFSLayer, capabilitiesUrl));
    //Lógica para coletar cor selecionada pelo usuário
   
    let facadeOL = $state<FacadeOL| null>(mapper_ol.facadeOL);
    
    onMount( async() =>{
        //facadeOL = mapper_ol.facadeOL;
        fetchFeatureCount();
    })
    //Variáveis modal
    onDestroy(async () => {
       // $hiddenDraw = 'hidden';
    })
    
    function btnSelectColorClicked() {
        colorInput?.click(); // Usa a referência direta ao input
    }
    // Lógica para abrir o modal
    let isOpen = false;
    let attributes = [];
    let linkToModal;
    let wfsName;
    

    // exemplo - capabilitiesUrl =  https://geoservicos.inde.gov.br/geoserver/ANM/ows?service=wfs&version=2.0.0&request=GetCapabilities
    // retorna  https://geoservicos.inde.gov.br/geoserver/ANM/ows
    function url(): string {  return wfsLayer.url}; 

   
    async function openModal() {
        //console.log(attributes.length);
        const link= url();
        //$currentModalLink = link;
        //let newAttributes = await getAttributes(wfsLayer.name(),link);
        //attributes = [...attributes, newAttributes];
        //console.log(attributes.length)
        if(link) {
            isOpen = true;
            linkToModal = link;
            wfsName = wfsLayer.name();
        }  
    }

    function closeModal(event) {
        event.preventDefault();
        isOpen = false;
    }

    
    async function btnMetadadoClicked() {
        if (!iWFSLayer.metadataURLs){
            return alert("A camada não está associada a metadados.")
        }
        //console.log("wfsLayer.metadataURLs()>", wfsLayer.metadataURLs());
        //let link = wfsLayer.metadataURLs()[0].link() //wmsLayer.metadataURL().link()
        iWFSLayer.metadataURLs.forEach((metadataURL: IMetadataUrl) => {
            let link = metadataURL.href         
            window.open(`/metadado?link=${encodeURIComponent(link)}`, '_blank');
        })
    };

     // Função para buscar o número de feições
     async function fetchFeatureCount() {
        const url: string|null = wfsLayer.urlGetFeatureCount();
        if (!url) {
            featureCount = 'sem acesso';
            console.warn("URL inválida para contagem de feições. Versão 1.0.0 do WFS não suporta esta funcionalidade.");
            return;
        }
        try {
            let response = await get(url);
            let data = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "text/xml");
            const countAttribute = xmlDoc.documentElement.getAttribute("numberMatched")
                || xmlDoc.documentElement.getAttribute("numberOfFeatures");
            if (!countAttribute?.trim()) {
                throw new Error('Resposta WFS sem a quantidade de feições.');
            }
            const count = featureCounted(xmlDoc);
            if (!Number.isFinite(count)) {
                throw new Error(`Quantidade de feições inválida: ${countAttribute}`);
            }
            featureCount = count;
            
        } catch (error) {
            const msg = `Erro ao buscar contagem de feições, url: ${url}`;
            console.error(msg, error);
            featureCount = 'sem acesso';
        }
    }

    function featureCountLabel(): string {
        if (typeof featureCount !== 'number') return featureCount;
        return `${featureCount} ${featureCount > 1 ? 'feições' : 'feição'}`;
    }
    
    function visibilityBtnMetadata():  'visible'| 'invisible' {
        console.log(`${iWFSLayer.name}: ${iWFSLayer?.metadataURLs == null}`);
        return !iWFSLayer?.metadataURLs || iWFSLayer.metadataURLs.length === 0 ? 'invisible': 'visible';
    };
  
    
   
    // Mapa de cores para armazenar as cores de cada grupo de feições
    const mapaDeCores = new Map();
    function getRandomColor(): string {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        const a = 0.7; // Transparência entre 0.1 e 1.0

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    function getColorForFeature(idDoGrupo: any): string {
        if (!mapaDeCores.has(idDoGrupo)) {

            const novaCor = getRandomColor();
            // Gera uma nova cor para o grupo se ainda não estiver presente
            //mapaDeCores.set(idDoGrupo, gerarCorAleatoria());
            mapaDeCores.set(idDoGrupo, novaCor);
            
           
        }
        return mapaDeCores.get(idDoGrupo);
    }

   
    function isUTM(coord) {
    // Para a zona UTM 32723, as coordenadas X (leste-oeste) normalmente estão em torno de 350000 metros ou mais
        const x = coord[0]; // Coordenada X (leste-oeste)
        const y = coord[1]; // Coordenada Y (norte-sul)

        console.log("x: " + x + "e " + "y :" + y )
        // Considera-se que se a coordenada X for maior que 100000 e Y maior que 100000, provavelmente está em UTM
        return x > 100000 && y > 100000;
}
    
    async function btnAddLayerClicked() {
        try {
            loading = true;
            if (!facadeOL) throw new Error('Mapa não inicializado.');
            const serviceUrl = capabilitiesUrl.split('?')[0];
            const layerExiste = layerManager.selectedLayers.some(
                layer => layer.type === 'WFS' && layer.name === iWFSLayer.name && layer.url === serviceUrl
            );
            if (layerExiste) return alert(`A camada ${iWFSLayer.name} já foi carregada`);    

            // Remove apenas a última camada WFS carregada anteriormente.
            /*
            const wfsLayersAtuais = layerManager.selectedLayers.filter(layer => layer.type === 'WFS') as WFSLayerOL[];
            const ultimaWfsCarregada = wfsLayersAtuais.at(-1);
            if (ultimaWfsCarregada) {
                facadeOL.removeWFSLayerOL(ultimaWfsCarregada);
                layerManager.selectedLayers = layerManager.selectedLayers.filter(
                    layer => layer.id !== ultimaWfsCarregada.id
                );
            }
            */
            let urlFeature = wfsLayer.urlGetFeature();
            let dados = await get(urlFeature);
            
            dados.headers.forEach((valor, chave) => {
  console.log(`${chave}: ${valor} `, urlFeature);
});
            let dadosJson = await dados.json();
        
            // Criando a cor da feição antes de definir o estilo padronizado
            let a_color: string = getRandomColor();
            const styleProperties = {color: a_color};       
            let wfsLayerOL: WFSLayerOL = facadeOL.addGeoJSONLayer(iWFSLayer, dadosJson, styleProperties, serviceUrl);
            const camada: any | null = wfsLayerOL?.layer ?? null;

            // Obtendo a extensão (bounding box) das feições adicionadas
            
            if (camada) {
                const extent = (camada as any).getSource().getExtent();
                const extentValida = extent.length === 4 && extent.every(Number.isFinite)
                    && extent[0] <= extent[2] && extent[1] <= extent[3];
                if (extentValida) facadeOL?.map.getView().fit(extent, {
                    size: facadeOL.map?.getSize?.(), 
                    padding: [50, 50, 50, 50], // Padding para ajustar margens
                    maxZoom: 18 // Define um zoom máximo
                });
            }
            layerManager.selectedLayers.push(wfsLayerOL);
            display = 'hidden';
            aleatoryColor = "#FFFFFF"
            loading = false;

        } catch (e: Error | any) {
            loading = false;
            console.error('Erro ao adicionar camada WFS:', e);
            alert(`Não foi possível adicionar a camada: ${e?.message ?? e}`);
        }
    }
    

    function btnFilterLayerClicked() {

    }
    
    
       
</script>

<div class="flex mt-1 relative {display} text-gray-700 ">
        {@render descricao_com_quantidade()}
        {@render botao_metadados()}
        {@render botao_cor_feature()}
        {@render botao_add_feature()}
        {@render botao_filter_feature()}
</div>
<!--
{#if linkToModal}
    <WfsModal {isOpen} {wfsName}  link={linkToModal} {closeModal} />
{/if}
-->
{#snippet descricao_com_quantidade()}
        <p class=" mt-1 flex-grow text-grey-darkest hover:bg-red truncate text-left text-xs" 
        title="{`${wfsLayer.description()} - ${featureCountLabel()}`}">
        {`${wfsLayer.description()} - ${featureCountLabel()}`}</p>
{/snippet}

{#snippet botao_metadados()}
<button  class="{visibilityBtnMetadata()} focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold py-1 px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(btnMetadadoClicked)} title="Metadados">
            <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" class="h-6 w-6" fill="#FCF3CF" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke="#1C2833" stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        </button>
{/snippet}

{#snippet botao_cor_feature()}
    <input type="color" class="hidden" bind:this={colorInput} bind:value={userColor}/>
    <button class="focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold py-1 px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(btnSelectColorClicked)} disabled={featureCount === 0} title="Escolha a cor das feições a serem renderizadas">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill={userColor ? userColor+'80' :  (aleatoryColor ? aleatoryColor : '#FFFFFF')} viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7h.01m3.486 1.513h.01m-6.978 0h.01M6.99 12H7m9 4h2.706a1.957 1.957 0 0 0 1.883-1.325A9 9 0 1 0 3.043 12.89 9.1 9.1 0 0 0 8.2 20.1a8.62 8.62 0 0 0 3.769.9 2.013 2.013 0 0 0 2.03-2v-.857A2.036 2.036 0 0 1 16 16Z"/>
            </svg>
    </button>
{/snippet}

{#snippet botao_add_feature()}
    {#if loading}
        <div  role="status">
            <svg aria-hidden="true" class="inline w-5 h-5 mb-2 ml-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
            </svg>
            <span class="sr-only">Loading...</span>
        </div>
    {:else}
        <button class="focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold py-1 px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(btnAddLayerClicked)}   disabled={featureCount === 0} title="Adicionar feições" id="addLayer">
            <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" viewBox="0 0 24 24" fill="#FEF9E7">
                <path stroke="#1C2833" fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd" />
            </svg>   
        </button>
    {/if}
{/snippet}

{#snippet botao_filter_feature()}
    <button class="focus:outline-none bg-grey-light hover:bg-grey text-grey-darkest font-bold py-1 px-1 rounded inline-flex items-center hover:bg-gray-200" 
        onclick={preventDefault(openModal)}  disabled={featureCount === 0} title="Filtrar feições" >
            <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px" viewBox="0 0 24 24" fill="#FFCC80">
                <path fill-rule="evenodd" d="M12 12l8-8V0H0v4l8 8v8l4-4v-4z" clip-rule="evenodd" />
            </svg>   
    </button>
{/snippet}
