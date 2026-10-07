// src/lib/ogc/csw/mgb/mgbConformance.ts
/**
 * Validador de Conformidade com o Perfil MGB 2.0 (Perfil de Metadados Geoespaciais do Brasil)
 * Baseado na publicação oficial da INDE / IBGE (liv101802.pdf, Apêndice 1).
 *
 * Quadros avaliados:
 * - Quadro 84: Conjunto mínimo de elementos obrigatórios para descrever recursos em geral, exceto serviços (15 elementos)
 * - Quadro 85: Conjunto mínimo de elementos obrigatórios para descrever CDG ou séries (Quadro 84 + 5 elementos = 20 elementos)
 * - Quadro 86: Conjunto mínimo de elementos obrigatórios para descrever CDG ou séries do SCN (Quadro 85 + 1 elemento = 21 elementos)
 * - Quadro 87: Conjunto mínimo de elementos obrigatórios para descrever serviços web sem recursos acoplados (16 elementos)
 * - Modo Automático (AUTO): Detecta o escopo do metadado e aplica o quadro adequado (Quadro 84 para não-geoespacial, Quadro 85 para CDG/séries, Quadro 87 para geosserviços).
 */

export type MGBQuadroId = 'AUTO' | '84' | '85' | '86' | '87';
export type MGBEffectiveQuadroId = '84' | '85' | '86' | '87';

export type MetadataScopeType = 'service' | 'dataset' | 'series' | 'nonGeographic';

export interface MetadataScopeInfo {
    scopeCode: string;
    scopeType: MetadataScopeType;
    scopeLabel: string;
    recommendedQuadro: MGBEffectiveQuadroId;
}

export interface MGBElementRule {
    id: number;
    name: string;
    description: string;
    path: string;
    check: (el: Element) => { compliant: boolean; value?: string };
}

export interface MGBElementResult {
    id: number;
    name: string;
    description: string;
    path: string;
    compliant: boolean;
    value: string;
}

export interface MGBEvaluationResult {
    quadroId: MGBEffectiveQuadroId;
    quadroTitle: string;
    scopeInfo: MetadataScopeInfo;
    totalElements: number;
    compliantElements: number;
    percentage: number;
    isFullyCompliant: boolean;
    elements: MGBElementResult[];
}

export interface MGBMetadataItem {
    identifier: string;
    title: string;
    summary: string;
    xmlElement: Element;
    evaluation: MGBEvaluationResult;
}

// ---------------------------------------------------------------------------
// Funções auxiliares tolerantes a namespaces (ISO 19139 gmd: e ISO 19115-3)
// ---------------------------------------------------------------------------

function getNodeValue(node: Element | null | undefined): string {
    if (!node) return '';
    const nilReason = node.getAttribute('nilReason') || node.getAttribute('gco:nilReason');
    if (nilReason === 'missing') return '';
    const codeListVal = node.getAttribute('codeListValue')?.trim();
    if (codeListVal) return codeListVal;
    const valAttr = node.getAttribute('value')?.trim();
    if (valAttr) return valAttr;
    const txt = node.textContent?.trim();
    if (txt) return txt;
    const childWithCode = node.querySelector?.('[codeListValue], [value]');
    if (childWithCode) {
        const childVal = childWithCode.getAttribute('codeListValue')?.trim() || childWithCode.getAttribute('value')?.trim();
        if (childVal) return childVal;
    }
    return '';
}

function findFirstText(parent: Element, selectors: string[]): string {
    for (const sel of selectors) {
        try {
            const node = parent.querySelector(sel);
            const val = getNodeValue(node);
            if (val) return val;
        } catch {
            // Ignora seletores com sintaxe não suportada em certos navegadores
        }
    }
    return '';
}

function hasAnyDescendantByLocalNames(parent: Element, localNames: string[]): boolean {
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const item = all[i];
        if (localNames.includes(item.localName)) {
            const val = getNodeValue(item);
            if (val) return true;
        }
    }
    return false;
}

function findFirstTextByLocalNames(parent: Element, localNames: string[]): string {
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const item = all[i];
        if (localNames.includes(item.localName)) {
            const val = getNodeValue(item);
            if (val) return val;
        }
    }
    return '';
}

// ---------------------------------------------------------------------------
// Detecção Automática do Escopo do Metadado
// ---------------------------------------------------------------------------

export function detectMetadataScope(el: Element): MetadataScopeInfo {
    // 1. Verifica se possui identificação explícita de serviço
    const hasServiceId = el.querySelector(
        'MD_ServiceIdentification, srv\\:SV_ServiceIdentification, SV_ServiceIdentification, serviceType, srv\\:serviceType'
    );
    if (hasServiceId) {
        return {
            scopeCode: 'service',
            scopeType: 'service',
            scopeLabel: 'Geosserviço (Service)',
            recommendedQuadro: '87'
        };
    }

    // 2. Procura declaração do hierarchyLevel ou metadataScope
    const scopeEl = el.querySelector(
        'hierarchyLevel MD_ScopeCode, gmd\\:hierarchyLevel gmd\\:MD_ScopeCode, metadataScope MD_ScopeCode, mdb\\:metadataScope mcc\\:MD_ScopeCode, hierarchyLevel'
    );

    let rawCode = '';
    if (scopeEl) {
        rawCode = (
            scopeEl.getAttribute('codeListValue') ||
            scopeEl.textContent ||
            ''
        ).trim().toLowerCase();
    }

    if (rawCode === 'service') {
        return {
            scopeCode: 'service',
            scopeType: 'service',
            scopeLabel: 'Geosserviço (Service)',
            recommendedQuadro: '87'
        };
    }

    if (rawCode === 'dataset') {
        return {
            scopeCode: 'dataset',
            scopeType: 'dataset',
            scopeLabel: 'Produto Geoespacial (CDG / Dataset)',
            recommendedQuadro: '85'
        };
    }

    if (rawCode === 'series') {
        return {
            scopeCode: 'series',
            scopeType: 'series',
            scopeLabel: 'Série de Dados Geoespaciais (Series)',
            recommendedQuadro: '85'
        };
    }

    if (rawCode.includes('nongeo') || rawCode === 'document' || rawCode === 'software') {
        return {
            scopeCode: rawCode || 'nonGeographicDataset',
            scopeType: 'nonGeographic',
            scopeLabel: 'Produto Não Geoespacial (Geral)',
            recommendedQuadro: '84'
        };
    }

    // 3. Fallback: analisa o conteúdo de identificação
    const hasBoundingBox = hasAnyDescendantByLocalNames(el, [
        'EX_GeographicBoundingBox',
        'westBoundLongitude',
        'topicCategory'
    ]);

    if (hasBoundingBox) {
        return {
            scopeCode: rawCode || 'dataset',
            scopeType: 'dataset',
            scopeLabel: 'Produto Geoespacial (CDG - Detectado por extensão)',
            recommendedQuadro: '85'
        };
    }

    return {
        scopeCode: rawCode || 'recurso',
        scopeType: 'nonGeographic',
        scopeLabel: 'Recurso em Geral (Não Geoespacial)',
        recommendedQuadro: '84'
    };
}

// ---------------------------------------------------------------------------
// Regras do Quadro 84: Recursos em geral, exceto serviços (15 elementos)
// ---------------------------------------------------------------------------
export const QUADRO_84_RULES: MGBElementRule[] = [
    {
        id: 1,
        name: 'Identificador do metadado',
        description: 'Código de identificação exclusivo para o registro de metadados.',
        path: 'MD_Metadata.metadataIdentifier > MD_Identifier.code | fileIdentifier',
        check: (el) => {
            const val = findFirstText(el, [
                'fileIdentifier CharacterString',
                'gmd\\:fileIdentifier gco\\:CharacterString',
                'metadataIdentifier code CharacterString',
                'mdb\\:metadataIdentifier mcc\\:MD_Identifier mcc\\:code gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(el, ['fileIdentifier', 'metadataIdentifier']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 2,
        name: 'Idioma do metadado',
        description: 'Idioma utilizado no documento de metadados.',
        path: 'defaultLocale > PT_Locale.language | language',
        check: (el) => {
            const val = findFirstText(el, [
                'language CharacterString',
                'language LanguageCode',
                'gmd\\:language gco\\:CharacterString',
                'gmd\\:language gmd\\:LanguageCode',
                'defaultLocale PT_Locale language LanguageCode',
                'mdb\\:defaultLocale lan\\:PT_Locale lan\\:language lan\\:LanguageCode'
            ]) || findFirstTextByLocalNames(el, ['LanguageCode', 'language']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 3,
        name: 'Código de caracteres do metadado',
        description: 'Padrão de codificação de caracteres dos metadados (ex: utf8).',
        path: 'defaultLocale > PT_Locale.characterEncoding | characterSet',
        check: (el) => {
            const csEl = el.querySelector('characterSet MD_CharacterSetCode, gmd\\:characterSet gmd\\:MD_CharacterSetCode, MD_CharacterSetCode');
            const codeAttr = csEl?.getAttribute('codeListValue') || csEl?.getAttribute('value');
            const val = codeAttr || findFirstText(el, [
                'characterSet MD_CharacterSetCode',
                'gmd\\:characterSet gmd\\:MD_CharacterSetCode',
                'characterSet',
                'gmd\\:characterSet',
                'defaultLocale PT_Locale characterEncoding MD_CharacterSetCode',
                'mdb\\:defaultLocale lan\\:PT_Locale lan\\:characterEncoding lan\\:MD_CharacterSetCode'
            ]) || findFirstTextByLocalNames(el, ['MD_CharacterSetCode', 'characterSet', 'characterEncoding']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 4,
        name: 'Escopo do metadado',
        description: 'Escopo ou nível hierárquico ao qual o metadado se aplica (ex: dataset, series, service).',
        path: 'metadataScope > MD_MetadataScope.resourceScope | hierarchyLevel',
        check: (el) => {
            const scopeEl = el.querySelector('hierarchyLevel MD_ScopeCode, gmd\\:hierarchyLevel gmd\\:MD_ScopeCode, metadataScope MD_ScopeCode');
            const codeAttr = scopeEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'hierarchyLevel MD_ScopeCode',
                'gmd\\:hierarchyLevel gmd\\:MD_ScopeCode',
                'metadataScope MD_MetadataScope resourceScope MD_ScopeCode',
                'mdb\\:metadataScope mdb\\:MD_MetadataScope mdb\\:resourceScope mcc\\:MD_ScopeCode'
            ]) || findFirstTextByLocalNames(el, ['MD_ScopeCode', 'hierarchyLevel', 'resourceScope']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 5,
        name: 'Papel desempenhado (Responsável pelo metadado)',
        description: 'Função desempenhada pelo responsável pelo metadado (ex: pointOfContact, custodian).',
        path: 'MD_Metadata.contact > CI_Responsibility.role | contact > CI_RoleCode',
        check: (el) => {
            const contactEl = el.querySelector('contact, gmd\\:contact, mdb\\:contact');
            if (!contactEl) return { compliant: false, value: 'Não informado' };
            const roleEl = contactEl.querySelector('role CI_RoleCode, gmd\\:role gmd\\:CI_RoleCode, cit\\:role cit\\:CI_RoleCode');
            const codeAttr = roleEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(contactEl as Element, [
                'role CI_RoleCode',
                'gmd\\:role gmd\\:CI_RoleCode',
                'cit\\:role cit\\:CI_RoleCode'
            ]) || findFirstTextByLocalNames(contactEl as Element, ['CI_RoleCode', 'role']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 6,
        name: 'Nome do responsável pelo metadado (Organização ou Indivíduo)',
        description: 'Identificação da organização ou indivíduo responsável pela elaboração do metadado.',
        path: 'MD_Metadata.contact > organisationName | individualName',
        check: (el) => {
            const contactEl = el.querySelector('contact, gmd\\:contact, mdb\\:contact');
            if (!contactEl) return { compliant: false, value: 'Não informado' };
            const val = findFirstText(contactEl as Element, [
                'organisationName CharacterString',
                'gmd\\:organisationName gco\\:CharacterString',
                'individualName CharacterString',
                'gmd\\:individualName gco\\:CharacterString',
                'cit\\:party cit\\:CI_Organisation cit\\:name gco\\:CharacterString',
                'cit\\:party cit\\:CI_Individual cit\\:name gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(contactEl as Element, ['organisationName', 'individualName']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 7,
        name: 'Valor da data do metadado',
        description: 'Data de criação, publicação ou atualização do metadado.',
        path: 'MD_Metadata.dateInfo > CI_Date.date | dateStamp',
        check: (el) => {
            const val = findFirstText(el, [
                'dateStamp Date',
                'dateStamp DateTime',
                'gmd\\:dateStamp gco\\:Date',
                'gmd\\:dateStamp gco\\:DateTime',
                'dateInfo CI_Date date Date',
                'dateInfo CI_Date date DateTime',
                'mdb\\:dateInfo cit\\:CI_Date cit\\:date gco\\:Date',
                'mdb\\:dateInfo cit\\:CI_Date cit\\:date gco\\:DateTime'
            ]) || findFirstTextByLocalNames(el, ['dateStamp']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 8,
        name: 'Tipo da data do metadado',
        description: 'Tipo de evento associado à data do metadado (ex: creation, publication, revision).',
        path: 'MD_Metadata.dateInfo > CI_Date.dateType | dateStamp',
        check: (el) => {
            const val = findFirstText(el, [
                'dateInfo CI_Date dateType CI_DateTypeCode',
                'mdb\\:dateInfo cit\\:CI_Date cit\\:dateType cit\\:CI_DateTypeCode',
                'dateStamp'
            ]) || (hasAnyDescendantByLocalNames(el, ['dateStamp']) ? 'Implícito (dateStamp)' : '');
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 9,
        name: 'Perfil de metadados / Padrão',
        description: 'Identificação do perfil ou padrão adotado (ex: Perfil MGB, ISO 19115).',
        path: 'metadataProfile > title | metadataStandardName',
        check: (el) => {
            const val = findFirstText(el, [
                'metadataStandardName CharacterString',
                'gmd\\:metadataStandardName gco\\:CharacterString',
                'metadataProfile CI_Citation title CharacterString',
                'mdb\\:metadataProfile cit\\:CI_Citation cit\\:title gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(el, ['metadataStandardName']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 10,
        name: 'Título do recurso',
        description: 'Nome pelo qual o recurso citado é conhecido.',
        path: 'identificationInfo > citation > title',
        check: (el) => {
            const val = findFirstText(el, [
                'identificationInfo citation title CharacterString',
                'gmd\\:identificationInfo gmd\\:citation gmd\\:title gco\\:CharacterString',
                'identificationInfo MD_DataIdentification citation CI_Citation title CharacterString',
                'mri\\:MD_DataIdentification cit\\:citation cit\\:CI_Citation cit\\:title gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(el, ['title']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 11,
        name: 'Valor da data do recurso',
        description: 'Data de referência temporal do próprio recurso.',
        path: 'identificationInfo > citation > date > date',
        check: (el) => {
            const val = findFirstText(el, [
                'identificationInfo citation CI_Date date Date',
                'identificationInfo citation CI_Date date DateTime',
                'gmd\\:identificationInfo gmd\\:citation gmd\\:CI_Date gmd\\:date gco\\:Date',
                'gmd\\:identificationInfo gmd\\:citation gmd\\:CI_Date gmd\\:date gco\\:DateTime',
                'mri\\:MD_DataIdentification cit\\:citation cit\\:CI_Citation cit\\:date cit\\:CI_Date cit\\:date gco\\:Date',
                'mri\\:MD_DataIdentification cit\\:citation cit\\:CI_Citation cit\\:date cit\\:CI_Date cit\\:date gco\\:DateTime'
            ]) || findFirstText(el, ['citation CI_Date date', 'citation date']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 12,
        name: 'Tipo da data do recurso',
        description: 'Identificação do evento da data do recurso (creation, publication ou revision).',
        path: 'identificationInfo > citation > date > dateType',
        check: (el) => {
            const dateTypeEl = el.querySelector('identificationInfo citation CI_Date dateType CI_DateTypeCode, gmd\\:dateType gmd\\:CI_DateTypeCode');
            const codeAttr = dateTypeEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'identificationInfo citation CI_Date dateType CI_DateTypeCode',
                'gmd\\:identificationInfo gmd\\:citation gmd\\:CI_Date gmd\\:dateType gmd\\:CI_DateTypeCode',
                'mri\\:MD_DataIdentification cit\\:citation cit\\:CI_Citation cit\\:date cit\\:CI_Date cit\\:dateType cit\\:CI_DateTypeCode'
            ]) || findFirstTextByLocalNames(el, ['CI_DateTypeCode', 'dateType']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 13,
        name: 'Resumo do recurso',
        description: 'Descrição narrativa breve do conteúdo do recurso.',
        path: 'identificationInfo > abstract',
        check: (el) => {
            const val = findFirstText(el, [
                'identificationInfo abstract CharacterString',
                'gmd\\:identificationInfo gmd\\:abstract gco\\:CharacterString',
                'mri\\:MD_DataIdentification mri\\:abstract gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(el, ['abstract']);
            return { compliant: !!val, value: val ? (val.length > 80 ? `${val.slice(0, 77)}...` : val) : 'Não informado' };
        }
    },
    {
        id: 14,
        name: 'Status do recurso',
        description: 'Estado do recurso (ex: completed, onGoing, planned, underDevelopment).',
        path: 'identificationInfo > status',
        check: (el) => {
            const statusEl = el.querySelector('identificationInfo status MD_ProgressCode, gmd\\:identificationInfo gmd\\:status gmd\\:MD_ProgressCode');
            const codeAttr = statusEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'identificationInfo status MD_ProgressCode',
                'gmd\\:identificationInfo gmd\\:status gmd\\:MD_ProgressCode',
                'mri\\:MD_DataIdentification mri\\:status msr\\:MD_ProgressCode'
            ]) || findFirstTextByLocalNames(el, ['MD_ProgressCode', 'status']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 15,
        name: 'Nome do responsável pelo recurso (Organização ou Indivíduo)',
        description: 'Organização ou indivíduo responsável pelo recurso.',
        path: 'identificationInfo > pointOfContact > organisationName | individualName',
        check: (el) => {
            const pocEl = el.querySelector('pointOfContact, gmd\\:pointOfContact, mri\\:pointOfContact');
            if (!pocEl) return { compliant: false, value: 'Não informado' };
            const val = findFirstText(pocEl as Element, [
                'organisationName CharacterString',
                'gmd\\:organisationName gco\\:CharacterString',
                'individualName CharacterString',
                'gmd\\:individualName gco\\:CharacterString',
                'cit\\:party cit\\:CI_Organisation cit\\:name gco\\:CharacterString',
                'cit\\:party cit\\:CI_Individual cit\\:name gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(pocEl as Element, ['organisationName', 'individualName']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    }
];

// ---------------------------------------------------------------------------
// Regras adicionais do Quadro 85: CDG ou Séries (5 elementos adicionais)
// ---------------------------------------------------------------------------
export const QUADRO_85_ADDITIONAL_RULES: MGBElementRule[] = [
    {
        id: 16,
        name: 'Tipo de representação espacial',
        description: 'Método utilizado para representar espacialmente a informação (ex: vector, grid, tin).',
        path: 'identificationInfo > spatialRepresentationType',
        check: (el) => {
            const srtEl = el.querySelector('spatialRepresentationType MD_SpatialRepresentationTypeCode, gmd\\:spatialRepresentationType gmd\\:MD_SpatialRepresentationTypeCode');
            const codeAttr = srtEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'spatialRepresentationType MD_SpatialRepresentationTypeCode',
                'gmd\\:spatialRepresentationType gmd\\:MD_SpatialRepresentationTypeCode',
                'mri\\:spatialRepresentationType msr\\:MD_SpatialRepresentationTypeCode'
            ]) || findFirstTextByLocalNames(el, ['MD_SpatialRepresentationTypeCode', 'spatialRepresentationType']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 17,
        name: 'Categoria temática',
        description: 'Tópico ou assunto principal abrangido pelo recurso (ex: boundaries, elevation, geoscientificInformation).',
        path: 'identificationInfo > topicCategory',
        check: (el) => {
            const val = findFirstText(el, [
                'topicCategory MD_TopicCategoryCode',
                'gmd\\:topicCategory gmd\\:MD_TopicCategoryCode',
                'mri\\:topicCategory mri\\:MD_TopicCategoryCode'
            ]) || findFirstTextByLocalNames(el, ['MD_TopicCategoryCode', 'topicCategory']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 18,
        name: 'Extensão geográfica (BBOX / Retângulo Envolvente)',
        description: 'Limites geográficos do recurso (coordenadas Oeste, Leste, Sul e Norte).',
        path: 'identificationInfo > extent > EX_Extent > EX_GeographicBoundingBox',
        check: (el) => {
            const west = findFirstText(el, ['westBoundLongitude Decimal', 'gmd\\:westBoundLongitude gco\\:Decimal']);
            const east = findFirstText(el, ['eastBoundLongitude Decimal', 'gmd\\:eastBoundLongitude gco\\:Decimal']);
            const south = findFirstText(el, ['southBoundLatitude Decimal', 'gmd\\:southBoundLatitude gco\\:Decimal']);
            const north = findFirstText(el, ['northBoundLatitude Decimal', 'gmd\\:northBoundLatitude gco\\:Decimal']);

            const hasAll = !!(west && east && south && north);
            if (hasAll) {
                return { compliant: true, value: `Oeste: ${west}, Leste: ${east}, Sul: ${south}, Norte: ${north}` };
            }
            if (west || east || south || north) {
                return { compliant: false, value: 'BBOX incompleto' };
            }
            const hasGeog = hasAnyDescendantByLocalNames(el, ['EX_GeographicBoundingBox', 'EX_GeographicDescription', 'geographicElement']);
            return { compliant: hasGeog, value: hasGeog ? 'Extensão presente' : 'Não informado' };
        }
    },
    {
        id: 19,
        name: 'Idioma dos dados',
        description: 'Idioma utilizado no conjunto de dados geoespaciais.',
        path: 'identificationInfo > defaultLocale.language | identificationInfo > language',
        check: (el) => {
            const idInfo = el.querySelector('identificationInfo, gmd\\:identificationInfo, mri\\:MD_DataIdentification');
            if (!idInfo) return { compliant: false, value: 'Não informado' };
            const val = findFirstText(idInfo as Element, [
                'language CharacterString',
                'language LanguageCode',
                'gmd\\:language gco\\:CharacterString',
                'gmd\\:language gmd\\:LanguageCode',
                'defaultLocale PT_Locale language LanguageCode'
            ]) || findFirstTextByLocalNames(idInfo as Element, ['LanguageCode', 'language']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 20,
        name: 'Código de caracteres dos dados',
        description: 'Padrão de codificação de caracteres dos dados do recurso.',
        path: 'identificationInfo > defaultLocale.characterEncoding | identificationInfo > characterSet',
        check: (el) => {
            const idInfo = el.querySelector('identificationInfo, gmd\\:identificationInfo, mri\\:MD_DataIdentification');
            if (!idInfo) return { compliant: false, value: 'Não informado' };
            const csEl = idInfo.querySelector('characterSet MD_CharacterSetCode, gmd\\:characterSet gmd\\:MD_CharacterSetCode, MD_CharacterSetCode, gmd\\:MD_CharacterSetCode');
            const codeAttr = csEl?.getAttribute('codeListValue') || csEl?.getAttribute('value');
            const val = codeAttr || findFirstText(idInfo as Element, [
                'characterSet MD_CharacterSetCode',
                'gmd\\:characterSet gmd\\:MD_CharacterSetCode',
                'characterSet',
                'gmd\\:characterSet',
                'defaultLocale PT_Locale characterEncoding MD_CharacterSetCode'
            ]) || findFirstTextByLocalNames(idInfo as Element, ['MD_CharacterSetCode', 'characterSet', 'characterEncoding']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    }
];

// ---------------------------------------------------------------------------
// Regra adicional do Quadro 86: CDG ou Séries do SCN (1 elemento adicional)
// ---------------------------------------------------------------------------
export const QUADRO_86_ADDITIONAL_RULES: MGBElementRule[] = [
    {
        id: 21,
        name: 'Resolução espacial (Escala ou Resolução Planimétrica/Vertical/Angular)',
        description: 'Fator de escala equivalente (denominador) ou resolução da distância da medição no solo.',
        path: 'identificationInfo > spatialResolution (equivalentScale.denominator | distance | vertical | angularDistance)',
        check: (el) => {
            const val = findFirstText(el, [
                'spatialResolution MD_Resolution equivalentScale MD_RepresentativeFraction denominator Integer',
                'gmd\\:spatialResolution gmd\\:MD_Resolution gmd\\:equivalentScale gmd\\:MD_RepresentativeFraction gmd\\:denominator gco\\:Integer',
                'spatialResolution MD_Resolution distance Distance',
                'gmd\\:spatialResolution gmd\\:MD_Resolution gmd\\:distance gco\\:Distance',
                'mri\\:spatialResolution msr\\:MD_Resolution msr\\:equivalentScale msr\\:MD_RepresentativeFraction msr\\:denominator gco\\:Integer'
            ]) || findFirstTextByLocalNames(el, ['equivalentScale', 'denominator', 'spatialResolution']);
            return { compliant: !!val, value: val ? `Escala/Resolução: 1:${val}` : 'Não informado' };
        }
    }
];

// ---------------------------------------------------------------------------
// Regras do Quadro 87: Serviços web sem recursos acoplados (16 elementos)
// ---------------------------------------------------------------------------
export const QUADRO_87_RULES: MGBElementRule[] = [
    // Elementos 1 a 9 herdados do Quadro 84 (linhas 1-9)
    ...QUADRO_84_RULES.slice(0, 9),

    // Elementos 10 a 16 específicos de MD_ServiceIdentification
    {
        id: 10,
        name: 'Título do serviço',
        description: 'Nome pelo qual o serviço citado é conhecido.',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).citation > title',
        check: (el) => {
            const val = findFirstText(el, [
                'MD_ServiceIdentification citation title CharacterString',
                'srv\\:SV_ServiceIdentification gmd\\:citation gmd\\:title gco\\:CharacterString',
                'SV_ServiceIdentification citation title CharacterString',
                'identificationInfo citation title CharacterString'
            ]) || findFirstTextByLocalNames(el, ['title']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 11,
        name: 'Valor da data do serviço',
        description: 'Data de referência temporal do serviço.',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).citation > date > date',
        check: (el) => {
            const val = findFirstText(el, [
                'MD_ServiceIdentification citation CI_Date date Date',
                'MD_ServiceIdentification citation CI_Date date DateTime',
                'srv\\:SV_ServiceIdentification gmd\\:citation gmd\\:CI_Date gmd\\:date gco\\:Date',
                'srv\\:SV_ServiceIdentification gmd\\:citation gmd\\:CI_Date gmd\\:date gco\\:DateTime',
                'identificationInfo citation CI_Date date'
            ]) || findFirstText(el, ['citation CI_Date date', 'citation date']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 12,
        name: 'Tipo da data do serviço',
        description: 'Identificação do evento da data do serviço (creation, publication ou revision).',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).citation > date > dateType',
        check: (el) => {
            const dateTypeEl = el.querySelector(
                'MD_ServiceIdentification citation CI_Date dateType CI_DateTypeCode, srv\\:SV_ServiceIdentification gmd\\:dateType gmd\\:CI_DateTypeCode, dateType'
            );
            const codeAttr = dateTypeEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'MD_ServiceIdentification citation CI_Date dateType CI_DateTypeCode',
                'srv\\:SV_ServiceIdentification gmd\\:dateType gmd\\:CI_DateTypeCode',
                'dateType CI_DateTypeCode'
            ]) || findFirstTextByLocalNames(el, ['CI_DateTypeCode', 'dateType']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 13,
        name: 'Resumo do serviço',
        description: 'Descrição narrativa breve do conteúdo e operações do serviço.',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).abstract',
        check: (el) => {
            const val = findFirstText(el, [
                'MD_ServiceIdentification abstract CharacterString',
                'srv\\:SV_ServiceIdentification gmd\\:abstract gco\\:CharacterString',
                'SV_ServiceIdentification abstract CharacterString',
                'identificationInfo abstract CharacterString'
            ]) || findFirstTextByLocalNames(el, ['abstract']);
            return { compliant: !!val, value: val ? (val.length > 80 ? `${val.slice(0, 77)}...` : val) : 'Não informado' };
        }
    },
    {
        id: 14,
        name: 'Status do serviço',
        description: 'Estado de operação do serviço (ex: completed, onGoing, planned, underDevelopment).',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).status',
        check: (el) => {
            const statusEl = el.querySelector(
                'MD_ServiceIdentification status MD_ProgressCode, srv\\:SV_ServiceIdentification gmd\\:status gmd\\:MD_ProgressCode, status MD_ProgressCode'
            );
            const codeAttr = statusEl?.getAttribute('codeListValue');
            const val = codeAttr || findFirstText(el, [
                'MD_ServiceIdentification status MD_ProgressCode',
                'srv\\:SV_ServiceIdentification gmd\\:status gmd\\:MD_ProgressCode',
                'status MD_ProgressCode'
            ]) || findFirstTextByLocalNames(el, ['MD_ProgressCode', 'status']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 15,
        name: 'Nome do responsável pelo serviço (Organização ou Indivíduo)',
        description: 'Organização ou indivíduo responsável pelo serviço.',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).pointOfContact > organisationName | individualName',
        check: (el) => {
            const pocEl = el.querySelector(
                'MD_ServiceIdentification pointOfContact, srv\\:SV_ServiceIdentification gmd\\:pointOfContact, pointOfContact'
            );
            if (!pocEl) return { compliant: false, value: 'Não informado' };
            const val = findFirstText(pocEl as Element, [
                'organisationName CharacterString',
                'gmd\\:organisationName gco\\:CharacterString',
                'individualName CharacterString',
                'gmd\\:individualName gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(pocEl as Element, ['organisationName', 'individualName']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    },
    {
        id: 16,
        name: 'Tipo de serviço (serviceType)',
        description: 'Nome da norma ou tipo de serviço (ex: OGC:WMS, OGC:WFS, OGC:WCS, CSW).',
        path: 'identificationInfo > (MD_ServiceIdentification | SV_ServiceIdentification).serviceType',
        check: (el) => {
            const val = findFirstText(el, [
                'serviceType GenericName',
                'serviceType LocalName',
                'serviceType CharacterString',
                'srv\\:serviceType gco\\:LocalName',
                'srv\\:serviceType gco\\:ScopedName',
                'srv\\:serviceType gco\\:CharacterString'
            ]) || findFirstTextByLocalNames(el, ['serviceType', 'GenericName']);
            return { compliant: !!val, value: val || 'Não informado' };
        }
    }
];

// Dicionário de títulos dos Quadros
export const MGB_QUADROS_INFO: Record<MGBQuadroId, { title: string; shortTitle: string; description: string }> = {
    'AUTO': {
        title: 'Perfil MGB — Modo Automático por Escopo',
        shortTitle: 'Automático',
        description: 'Validação adaptativa por escopo: Quadro 87 para geosserviços, Quadro 85 para CDG/séries e Quadro 84 para não-geoespaciais.'
    },
    '84': {
        title: 'Quadro 84 — Recursos em geral (exceto serviços)',
        shortTitle: 'Quadro 84 (Não-geoespacial)',
        description: 'Conjunto mínimo de 15 elementos obrigatórios do Perfil MGB para produtos não geoespaciais e recursos gerais.'
    },
    '85': {
        title: 'Quadro 85 — CDG ou séries',
        shortTitle: 'Quadro 85 (CDG / Séries)',
        description: 'Conjunto mínimo de 20 elementos obrigatórios para Conjuntos de Dados Geoespaciais (CDG) ou séries.'
    },
    '86': {
        title: 'Quadro 86 — CDG ou séries do SCN',
        shortTitle: 'Quadro 86 (SCN)',
        description: 'Conjunto mínimo de 21 elementos obrigatórios para CDG ou séries do Sistema Cartográfico Nacional.'
    },
    '87': {
        title: 'Quadro 87 — Serviços web sem recursos acoplados',
        shortTitle: 'Quadro 87 (Geosserviços)',
        description: 'Conjunto mínimo de 16 elementos obrigatórios do Perfil MGB para geosserviços (WMS, WFS, WCS, CSW).'
    }
};

/**
 * Retorna o array de regras consolidado para o Quadro MGB especificado
 */
export function getRulesForQuadro(quadroId: MGBEffectiveQuadroId): MGBElementRule[] {
    if (quadroId === '84') {
        return QUADRO_84_RULES;
    }
    if (quadroId === '85') {
        return [...QUADRO_84_RULES, ...QUADRO_85_ADDITIONAL_RULES];
    }
    if (quadroId === '86') {
        return [...QUADRO_84_RULES, ...QUADRO_85_ADDITIONAL_RULES, ...QUADRO_86_ADDITIONAL_RULES];
    }
    return QUADRO_87_RULES;
}

/**
 * Avalia um elemento XML de metadado (MD_Metadata) em relação ao Quadro MGB selecionado ou de forma automática pelo escopo
 */
export function evaluateMGBRecord(metadataEl: Element, requestedQuadro: MGBQuadroId = 'AUTO'): MGBEvaluationResult {
    const scopeInfo = detectMetadataScope(metadataEl);

    // Se solicitado 'AUTO', aplica o quadro correspondente ao escopo do metadado:
    // - service -> Quadro 87 (16 elementos)
    // - dataset / series -> Quadro 85 (20 elementos)
    // - nonGeographic / geral -> Quadro 84 (15 elementos)
    const effectiveQuadro: MGBEffectiveQuadroId = requestedQuadro === 'AUTO'
        ? scopeInfo.recommendedQuadro
        : requestedQuadro;

    const rules = getRulesForQuadro(effectiveQuadro);
    const results: MGBElementResult[] = [];
    let compliantCount = 0;

    for (const rule of rules) {
        const { compliant, value } = rule.check(metadataEl);
        if (compliant) {
            compliantCount++;
        }
        results.push({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            path: rule.path,
            compliant,
            value: value ?? (compliant ? 'Conforme' : 'Não informado')
        });
    }

    const totalElements = rules.length;
    const percentage = totalElements === 0 ? 0 : Math.round((compliantCount / totalElements) * 100);

    return {
        quadroId: effectiveQuadro,
        quadroTitle: MGB_QUADROS_INFO[effectiveQuadro].title,
        scopeInfo,
        totalElements,
        compliantElements: compliantCount,
        percentage,
        isFullyCompliant: compliantCount === totalElements,
        elements: results
    };
}
