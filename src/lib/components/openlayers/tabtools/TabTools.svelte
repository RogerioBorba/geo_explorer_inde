<script lang="ts">
    import {Tabs, TabItem} from 'flowbite-svelte';
    import BoundingBoxCoordinates from "$lib/components/openlayers/boundingBox/BoundingBoxCoordinates.svelte";
    import FeatureInfo from '$lib/components/openlayers/featureInfo/FeatureInfo.svelte';

   // import WMSSearchByNomeTitulo from './WMSSearchByNomeTitulo.svelte'
   //import WmsSearchByPalavraChave from './WMSSearchByPalavraChave.svelte';
   // import WmsPesquisaEspacial from './WMSPesquisaEspacial.svelte';
</script>
    
<Tabs style="underline" >
    <TabItem open title='Retângulo envolvente'>
        <BoundingBoxCoordinates />
    </TabItem>
    <TabItem title='Informação da camada'>
        <FeatureInfo />
    </TabItem>
        
    <!--
    </TabItem>
    <TabItem title='Por nome ou título'>
        <WMSSearchByNomeTitulo></WMSSearchByNomeTitulo>
        
    </TabItem>
    <TabItem title='Por palavra chave'>
        <WmsSearchByPalavraChave></WmsSearchByPalavraChave>
    </TabItem>

    <TabItem title='Pesquisa espacial'>
        <WmsPesquisaEspacial></WmsPesquisaEspacial>
    -->    
    
</Tabs>
