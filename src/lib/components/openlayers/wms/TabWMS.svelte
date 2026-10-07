<script lang="ts">
    import { Tabs, TabItem } from 'flowbite-svelte';
    import BaseWMS from './BaseWMS.svelte';
    import WMSBoundingBoxSearch from './WMSBoundingBoxSearch.svelte';
    import WMSKeywordSearch from './WMSKeywordSearch.svelte';
</script>

<Tabs style="underline">
    <TabItem open title="Por instituicao">
        <BaseWMS />
    </TabItem>
    <TabItem title="Por palavra-chave">
        <WMSKeywordSearch />
    </TabItem>
    <TabItem title="Por retangulo">
        <WMSBoundingBoxSearch />
    </TabItem>
</Tabs>
