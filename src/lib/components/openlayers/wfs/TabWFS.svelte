<script lang="ts">
    import { Tabs, TabItem } from 'flowbite-svelte';
    import BaseWFS from './BaseWFS.svelte';
    import WFSKeywordSearch from './WFSKeywordSearch.svelte';
    import WFSBoundingBoxSearch from './WFSBoundingBoxSearch.svelte';
</script>
    
<Tabs style="underline" >
    <TabItem open title="Por instituição">
        <BaseWFS />
    </TabItem>
    <TabItem title="Por palavra-chave">
        <WFSKeywordSearch />
    </TabItem>
    <TabItem title="Por retângulo">
        <WFSBoundingBoxSearch />
    </TabItem>
</Tabs>
