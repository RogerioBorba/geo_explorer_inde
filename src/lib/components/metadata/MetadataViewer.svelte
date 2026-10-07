<script lang="ts">
    import { onMount } from 'svelte';
    import { get } from '#lib/request/get.ts';

    interface Props {
        sourceLink?: string;
        backUrl?: string;
        backLabel?: string;
    }

    let {
        sourceLink = '',
        backUrl = '/visualizador/ol',
        backLabel = 'Voltar ao visualizador'
    }: Props = $props();

    type MetadataDate = {
        type: string;
        value: string;
    };

    type MetadataContact = {
        name: string;
        organization: string;
        role: string;
        email: string;
    };

    type MetadataLink = {
        title: string;
        description: string;
        protocol: string;
        href: string;
        functionLabel: string;
    };

    type MetadataExtent = {
        west: string;
        south: string;
        east: string;
        north: string;
    };

    type MetadataViewModel = {
        title: string;
        abstractText: string;
        purpose: string;
        status: string[];
        keywords: string[];
        dates: MetadataDate[];
        identifiers: string[];
        contacts: MetadataContact[];
        links: MetadataLink[];
        extents: MetadataExtent[];
        lineage: string[];
        topicCategories: string[];
        languages: string[];
        metadataDate: string;
        metadataStandard: string;
        rawUrl: string;
    };

    let loading = $state(true);
    let errorMessage = $state('');
    let sourceUrl = $state('');
    let metadata = $state<MetadataViewModel | null>(null);

    function cleanText(value: string | null | undefined): string {
        return (value ?? '').replace(/\s+/g, ' ').trim();
    }

    function toTitleCase(value: string): string {
        if (!value) return '';
        return value
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function selfAndDescendants(root: Element): Element[] {
        return [root, ...Array.from(root.getElementsByTagName('*'))];
    }

    function hasLocalName(el: Element, localNames: string | string[]): boolean {
        const names = Array.isArray(localNames) ? localNames : [localNames];
        return names.includes(el.localName);
    }

    function firstDescendant(root: Element, localNames: string | string[]): Element | null {
        return selfAndDescendants(root).find((el) => hasLocalName(el, localNames)) ?? null;
    }

    function descendants(root: Element, localNames: string | string[]): Element[] {
        return selfAndDescendants(root).filter((el) => hasLocalName(el, localNames));
    }

    function textFromFirst(root: Element | null, localNames: string | string[]): string {
        if (!root) return '';
        return cleanText(firstDescendant(root, localNames)?.textContent);
    }

    function uniqueStrings(values: string[]): string[] {
        return [...new Set(values.map(cleanText).filter(Boolean))];
    }

    function normalizeMetadataUrl(url: string): string {
        let normalized = url;
        const gmdSchema = 'outputschema=http%3A%2F%2Fwww.isotc211.org%2F2005%2Fgmd';

        if (normalized.includes('outputschema=http%3A%2F%2Fwww.w3.org%2F2005%2FAtom')) {
            normalized = normalized.replace(
                'outputschema=http%3A%2F%2Fwww.w3.org%2F2005%2FAtom',
                gmdSchema
            );
        }

        if (normalized.includes('outputschema=http%3A%2F%2Fwww.opengis.net%2Fcat%2Fcsw%2Fcsdgm')) {
            normalized = normalized.replace(
                'outputschema=http%3A%2F%2Fwww.opengis.net%2Fcat%2Fcsw%2Fcsdgm',
                gmdSchema
            );
        }

        return normalized;
    }

    function parseDates(root: Element): MetadataDate[] {
        const dates = descendants(root, 'CI_Date').map((dateEl) => {
            const typeCodeEl = firstDescendant(dateEl, 'CI_DateTypeCode');
            const rawType = cleanText(typeCodeEl?.getAttribute('codeListValue') || typeCodeEl?.textContent);
            const value = textFromFirst(dateEl, ['Date', 'DateTime']);

            return {
                type: rawType ? toTitleCase(rawType) : 'Data',
                value
            };
        });

        return dates.filter((item) => item.value);
    }

    function parseContacts(root: Element): MetadataContact[] {
        const contacts = descendants(root, ['CI_ResponsibleParty', 'CI_Organisation', 'CI_Individual']).map((contactEl) => {
            const individualName = textFromFirst(contactEl, 'individualName');
            const organization = textFromFirst(contactEl, ['organisationName', 'organizationName']);
            const positionName = textFromFirst(contactEl, 'positionName');
            const roleEl = firstDescendant(contactEl, 'CI_RoleCode');
            const role = cleanText(roleEl?.getAttribute('codeListValue') || roleEl?.textContent);
            const email = textFromFirst(contactEl, 'electronicMailAddress');

            return {
                name: individualName || positionName || organization || 'Contato sem identificação',
                organization,
                role: toTitleCase(role),
                email
            };
        });

        const seen = new Set<string>();
        return contacts.filter((contact) => {
            const key = `${contact.name}|${contact.organization}|${contact.role}|${contact.email}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return Boolean(contact.name || contact.organization || contact.email);
        });
    }

    function parseLinks(root: Element): MetadataLink[] {
        const links = descendants(root, 'CI_OnlineResource').map((linkEl) => {
            const linkageEl = firstDescendant(linkEl, 'linkage');
            const href = cleanText(
                firstDescendant(linkageEl ?? linkEl, ['URL', 'CharacterString'])?.textContent
            );
            const title = textFromFirst(linkEl, ['name', 'title']);
            const description = textFromFirst(linkEl, 'description');
            const protocol = textFromFirst(linkEl, 'protocol');
            const functionEl = firstDescendant(linkEl, 'CI_OnLineFunctionCode');
            const functionLabel = cleanText(
                functionEl?.getAttribute('codeListValue') || functionEl?.textContent
            );

            return {
                title: title || protocol || 'Recurso online',
                description,
                protocol,
                href,
                functionLabel: toTitleCase(functionLabel)
            };
        });

        const seen = new Set<string>();
        return links.filter((link) => {
            if (!link.href) return false;
            if (seen.has(link.href)) return false;
            seen.add(link.href);
            return true;
        });
    }

    function parseExtents(root: Element): MetadataExtent[] {
        return descendants(root, 'EX_GeographicBoundingBox')
            .map((extentEl) => ({
                west: textFromFirst(extentEl, 'westBoundLongitude'),
                south: textFromFirst(extentEl, 'southBoundLatitude'),
                east: textFromFirst(extentEl, 'eastBoundLongitude'),
                north: textFromFirst(extentEl, 'northBoundLatitude')
            }))
            .filter((extent) => extent.west || extent.south || extent.east || extent.north);
    }

    function parseLineage(root: Element): string[] {
        const lineageBlocks = descendants(root, ['LI_Lineage', 'LI_ProcessStep']);
        return uniqueStrings(
            lineageBlocks.flatMap((block) =>
                descendants(block, ['statement', 'description']).map((el) => cleanText(el.textContent))
            )
        );
    }

    function extractMetadata(doc: Document, rawUrl: string): MetadataViewModel {
        const metadataEl = Array.from(doc.getElementsByTagName('*')).find((el) => el.localName === 'MD_Metadata');
        if (!metadataEl) {
            throw new Error('O endereço não retornou um registro ISO MD_Metadata.');
        }

        const identificationEl =
            firstDescendant(metadataEl, ['MD_DataIdentification', 'SV_ServiceIdentification']) ?? metadataEl;
        const citationEl = firstDescendant(identificationEl, 'CI_Citation');

        const title = textFromFirst(citationEl ?? identificationEl, 'title') || 'Metadado sem título';
        const abstractText = textFromFirst(identificationEl, 'abstract');
        const purpose = textFromFirst(identificationEl, 'purpose');
        const status = uniqueStrings(
            descendants(identificationEl, ['MD_ProgressCode', 'status']).map((el) =>
                cleanText(el.getAttribute('codeListValue') || el.textContent)
            )
        );
        const keywords = uniqueStrings(
            descendants(identificationEl, ['keyword', 'Keyword']).map((el) => cleanText(el.textContent))
        );
        const identifiers = uniqueStrings([
            textFromFirst(metadataEl, 'fileIdentifier'),
            textFromFirst(metadataEl, 'metadataIdentifier'),
            ...descendants(citationEl ?? identificationEl, ['code', 'identifier']).map((el) => cleanText(el.textContent))
        ]);
        const topicCategories = uniqueStrings(
            descendants(identificationEl, 'topicCategory').map((el) => cleanText(el.textContent))
        );
        const languages = uniqueStrings(
            descendants(metadataEl, ['LanguageCode', 'language']).map((el) =>
                cleanText(el.getAttribute('codeListValue') || el.textContent)
            )
        );
        const metadataDate =
            textFromFirst(metadataEl, 'dateStamp') ||
            textFromFirst(metadataEl, 'dateInfo') ||
            textFromFirst(metadataEl, ['Date', 'DateTime']);
        const metadataStandard = uniqueStrings([
            textFromFirst(metadataEl, 'metadataStandardName'),
            textFromFirst(metadataEl, 'metadataStandardVersion')
        ]).join(' - ');

        return {
            title,
            abstractText,
            purpose,
            status,
            keywords,
            dates: parseDates(citationEl ?? identificationEl),
            identifiers,
            contacts: parseContacts(metadataEl),
            links: parseLinks(metadataEl),
            extents: parseExtents(metadataEl),
            lineage: parseLineage(metadataEl),
            topicCategories,
            languages,
            metadataDate,
            metadataStandard,
            rawUrl
        };
    }

    async function loadMetadata() {
        loading = true;
        errorMessage = '';

        try {
            const requestedLink = sourceLink.trim();
            if (!requestedLink) {
                throw new Error('Nenhum link de metadado foi informado.');
            }

            const requestedUrl = new URL(requestedLink);
            if (!['http:', 'https:'].includes(requestedUrl.protocol) || requestedUrl.username || requestedUrl.password) {
                throw new Error('O endereço de metadado deve usar HTTP ou HTTPS.');
            }
            sourceUrl = requestedUrl.href;

            const response = await get(normalizeMetadataUrl(sourceUrl), {
                headers: {
                    Accept: 'application/xml, text/xml, application/octet-stream;q=0.9, */*;q=0.8'
                }
            });

            const xmlText = await response.text();
            const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                throw new Error('O conteúdo retornado não é um XML válido.');
            }

            metadata = extractMetadata(doc, sourceUrl);
        } catch (error) {
            metadata = null;
            errorMessage = error instanceof Error ? error.message : 'Não foi possível carregar o metadado.';
        } finally {
            loading = false;
        }
    }

    onMount(loadMetadata);
</script>

<svelte:head>
    <title>{metadata ? `${metadata.title} | Metadado` : 'Visualizador de Metadado'}</title>
</svelte:head>

{#if loading}
    <div class="min-h-screen bg-slate-100 px-4 py-10">
        <div class="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Metadado</p>
            <h1 class="mt-2 text-3xl font-semibold text-slate-900">Carregando registro</h1>
            <p class="mt-3 animate-pulse text-slate-600">Buscando e interpretando o XML do metadado...</p>
        </div>
    </div>
{:else if errorMessage}
    <div class="min-h-screen bg-slate-100 px-4 py-10">
        <div class="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">Falha</p>
            <h1 class="mt-2 text-3xl font-semibold text-slate-900">Não foi possível abrir o metadado</h1>
            <p class="mt-4 text-slate-700">{errorMessage}</p>
            {#if sourceUrl}
                <a
                    class="mt-6 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Abrir XML original
                </a>
            {/if}
        </div>
    </div>
{:else if metadata}
    <div class="min-h-screen bg-[linear-gradient(180deg,#e0f2fe_0%,#f8fafc_22%,#f8fafc_100%)] px-4 py-8 text-slate-800">
        <div class="mx-auto max-w-6xl">
            <div class="rounded-[2rem] border border-sky-100 bg-white/95 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
                <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div class="max-w-4xl">
                        <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Registro de metadado</p>
                        <h1 class="mt-3 text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                            {metadata.title}
                        </h1>
                        {#if metadata.abstractText}
                            <p class="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
                                {metadata.abstractText}
                            </p>
                        {/if}
                    </div>

                    <div class="flex flex-wrap gap-2 md:justify-end">
                        <a
                            class="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                            href={metadata.rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            XML original
                        </a>
                        {#if backUrl}
                            <a
                                class="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                href={backUrl}
                            >
                                {backLabel}
                            </a>
                        {/if}
                    </div>
                </div>

                <div class="mt-6 grid gap-3 md:grid-cols-4">
                    {#if metadata.keywords.length > 0}
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Palavras-chave</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{metadata.keywords.length}</p>
                        </div>
                    {/if}
                    {#if metadata.links.length > 0}
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Recursos online</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{metadata.links.length}</p>
                        </div>
                    {/if}
                    {#if metadata.contacts.length > 0}
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Contatos</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{metadata.contacts.length}</p>
                        </div>
                    {/if}
                    {#if metadata.extents.length > 0}
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Extensoes geograficas</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{metadata.extents.length}</p>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section class="space-y-6">
                    <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 class="text-lg font-semibold text-slate-900">Informações do metadado</h2>
                        <div class="mt-4 grid gap-4 md:grid-cols-2">
                            {#if metadata.purpose}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Finalidade</p>
                                    <p class="mt-2 text-sm leading-6 text-slate-700">{metadata.purpose}</p>
                                </div>
                            {/if}
                            {#if metadata.metadataDate}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Data do metadado</p>
                                    <p class="mt-2 text-sm text-slate-700">{metadata.metadataDate}</p>
                                </div>
                            {/if}
                            {#if metadata.metadataStandard}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Padrao</p>
                                    <p class="mt-2 text-sm text-slate-700">{metadata.metadataStandard}</p>
                                </div>
                            {/if}
                            {#if metadata.languages.length > 0}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Idiomas</p>
                                    <p class="mt-2 text-sm text-slate-700">{metadata.languages.join(', ')}</p>
                                </div>
                            {/if}
                            {#if metadata.status.length > 0}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Situacao</p>
                                    <p class="mt-2 text-sm text-slate-700">{metadata.status.join(', ')}</p>
                                </div>
                            {/if}
                            {#if metadata.topicCategories.length > 0}
                                <div>
                                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Categorias tematicas</p>
                                    <p class="mt-2 text-sm text-slate-700">{metadata.topicCategories.join(', ')}</p>
                                </div>
                            {/if}
                        </div>
                    </article>

                    {#if metadata.links.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Recursos online</h2>
                            <div class="mt-4 grid gap-3">
                                {#each metadata.links as link}
                                    <a
                                        class="rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50"
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div class="min-w-0">
                                                <p class="font-medium text-slate-900">{link.title}</p>
                                                {#if link.description}
                                                    <p class="mt-1 text-sm leading-6 text-slate-600">{link.description}</p>
                                                {/if}
                                                <p class="mt-2 break-all text-xs text-slate-500">{link.href}</p>
                                            </div>
                                            <div class="flex shrink-0 flex-wrap gap-2">
                                                {#if link.protocol}
                                                    <span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                                        {link.protocol}
                                                    </span>
                                                {/if}
                                                {#if link.functionLabel}
                                                    <span class="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-800">
                                                        {link.functionLabel}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </a>
                                {/each}
                            </div>
                        </article>
                    {/if}

                    {#if metadata.lineage.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Linhagem e processamento</h2>
                            <div class="mt-4 space-y-3">
                                {#each metadata.lineage as item}
                                    <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                                        {item}
                                    </div>
                                {/each}
                            </div>
                        </article>
                    {/if}
                </section>

                <aside class="space-y-6">
                    {#if metadata.keywords.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Palavras-chave</h2>
                            <div class="mt-4 flex flex-wrap gap-2">
                                {#each metadata.keywords as keyword}
                                    <span class="rounded-full bg-sky-50 px-3 py-2 text-sm text-sky-800 ring-1 ring-sky-100">
                                        {keyword}
                                    </span>
                                {/each}
                            </div>
                        </article>
                    {/if}

                    {#if metadata.dates.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Datas relevantes do recurso</h2>
                            <div class="mt-4 space-y-3">
                                {#each metadata.dates as date}
                                    <div class="rounded-2xl bg-slate-50 p-4">
                                        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{date.type}</p>
                                        <p class="mt-2 text-sm text-slate-800">{date.value}</p>
                                    </div>
                                {/each}
                            </div>
                        </article>
                    {/if}

                    {#if metadata.identifiers.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Identificadores</h2>
                            <ul class="mt-4 space-y-3 text-sm text-slate-700">
                                {#each metadata.identifiers as identifier}
                                    <li class="break-all rounded-2xl bg-slate-50 p-4">{identifier}</li>
                                {/each}
                            </ul>
                        </article>
                    {/if}

                    {#if metadata.contacts.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Contatos</h2>
                            <div class="mt-4 space-y-3">
                                {#each metadata.contacts as contact}
                                    <div class="rounded-2xl bg-slate-50 p-4">
                                        <p class="font-medium text-slate-900">{contact.name}</p>
                                        {#if contact.organization}
                                            <p class="mt-1 text-sm text-slate-600">{contact.organization}</p>
                                        {/if}
                                        <div class="mt-2 flex flex-wrap gap-2">
                                            {#if contact.role}
                                                <span class="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
                                                    {contact.role}
                                                </span>
                                            {/if}
                                            {#if contact.email}
                                                <a
                                                    class="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-800 hover:bg-sky-200"
                                                    href={`mailto:${contact.email}`}
                                                >
                                                    {contact.email}
                                                </a>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </article>
                    {/if}

                    {#if metadata.extents.length > 0}
                        <article class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="text-lg font-semibold text-slate-900">Extensao geografica</h2>
                            <div class="mt-4 space-y-3">
                                {#each metadata.extents as extent}
                                    <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                        <p>Oeste: {extent.west || '-'}</p>
                                        <p>Sul: {extent.south || '-'}</p>
                                        <p>Leste: {extent.east || '-'}</p>
                                        <p>Norte: {extent.north || '-'}</p>
                                    </div>
                                {/each}
                            </div>
                        </article>
                    {/if}
                </aside>
            </div>
        </div>
    </div>
{/if}
