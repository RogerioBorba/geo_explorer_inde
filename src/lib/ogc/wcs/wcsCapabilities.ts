// ----------------------------------------------------------------------
// Interfaces principais do WCS GetCapabilities 2.0.1
// ----------------------------------------------------------------------

export interface IWCSOnlineResource {
  href: string;
}

export interface IWCSMetadataURL {
  type?: string;
  format?: string;
  href: string;
}

export interface IWCSContactInformation {
  person?: string;
  organization?: string;
  position?: string;
  email?: string;
}

export interface IWCSServiceIdentification {
  title: string;
  abstract?: string;
  keywords?: string[];
  serviceType: string;
  serviceTypeVersion?: string;
  fees?: string;
  accessConstraints?: string;
}

export interface IWCSServiceProvider {
  providerName: string;
  providerSite?: IWCSOnlineResource;
  contactInformation?: IWCSContactInformation;
}

export interface IWCSBoundingBox {
  lowerCorner: [number, number];
  upperCorner: [number, number];
}

export interface IWCSCoverageDescription {
  identifier: string;
  title?: string;
  abstract?: string;
  keywords?: string[];
  boundingBox?: IWCSBoundingBox;
  metadataURLs?: IWCSMetadataURL[];
  nativeCRS?: string;
  formats?: string[];
}

export interface IWCSSummary {
  title: string;
  abstract?: string;
  keywords?: string[];
  metadata?: IWCSMetadataURL[];
  coverages: IWCSCoverageDescription[];
}

export interface IWCSGetCapabilities {
  version: string;
  /** Endereço usado no GetCapabilities, necessário para as demais operações WCS. */
  serviceUrl?: string;
  describeCoverageUrl?: string;
  updateSequence?: string;
  serviceIdentification?: IWCSServiceIdentification;
  serviceProvider?: IWCSServiceProvider;
  operationsMetadata?: any;
  summary?: IWCSSummary;
}

// ----------------------------------------------------------------------
// Funções utilitárias
// ----------------------------------------------------------------------

function textOf(el: Element | null): string | undefined {
  return el?.textContent?.trim() || undefined;
}

function textsOf(parent: Element | Document, tag: string): string[] {
  return Array.from(parent.getElementsByTagName(tag))
    .map(el => el.textContent?.trim() || '')
    .filter(Boolean);
}

function attr(el: Element | null, name: string): string | undefined {
  return el?.getAttribute(name) || undefined;
}

// Namespaces
const OWS_NS = 'http://www.opengis.net/ows/2.0';
const WCS_NS = 'http://www.opengis.net/wcs/2.0';
const WCS_SERVICE_NS = 'http://www.opengis.net/wcs/2.0/service';

function textNS(
  parent: Element | Document,
  ns: string,
  tag: string
): string | undefined {
  return parent.getElementsByTagNameNS(ns, tag)[0]?.textContent?.trim();
}

function textsNS(
  parent: Element | Document,
  ns: string,
  tag: string
): string[] {
  return Array.from(parent.getElementsByTagNameNS(ns, tag))
    .map(el => el.textContent?.trim() || '')
    .filter(Boolean);
}

function firstLocal(
  parent: Element | Document,
  tag: string
): Element | undefined {
  return Array.from(parent.getElementsByTagName(tag))[0];
}

// ----------------------------------------------------------------------
// Parsers
// ----------------------------------------------------------------------

function parseServiceIdentification(doc: Document): IWCSServiceIdentification | undefined {
  const si = doc.getElementsByTagNameNS(OWS_NS, 'ServiceIdentification')[0];
  if (!si) return undefined;

  return {
    title: textNS(si, OWS_NS, 'Title') || '',
    abstract: textNS(si, OWS_NS, 'Abstract'),
    keywords: textsNS(si, OWS_NS, 'Keyword'),
    serviceType: textNS(si, OWS_NS, 'ServiceType') || 'WCS',
    serviceTypeVersion: textNS(si, OWS_NS, 'ServiceTypeVersion'),
    fees: textNS(si, OWS_NS, 'Fees'),
    accessConstraints: textNS(si, OWS_NS, 'AccessConstraints')
  };
}

function parseServiceProvider(doc: Document): IWCSServiceProvider | undefined {
  const sp = doc.getElementsByTagNameNS(OWS_NS, 'ServiceProvider')[0];
  if (!sp) return undefined;

  const contactInfo = sp.getElementsByTagNameNS(OWS_NS, 'ServiceContact')[0];

  return {
    providerName: textNS(sp, OWS_NS, 'ProviderName') || '',
    providerSite: undefined,
    contactInformation: contactInfo ? {
      person: textNS(contactInfo, OWS_NS, 'IndividualName'),
      organization: textNS(sp, OWS_NS, 'ProviderName'),
      email: textNS(contactInfo, OWS_NS, 'ElectronicMailAddress')
    } : undefined
  };
}

function parseCoverageDescription(el: Element, version: string): IWCSCoverageDescription {
  // Para WCS 2.0.1
  if (version.startsWith('2.')) {
    return {
      identifier: textNS(el, WCS_NS, 'CoverageId') || textNS(el, OWS_NS, 'Identifier') || '',
      title: textNS(el, OWS_NS, 'Title'),
      abstract: textNS(el, OWS_NS, 'Abstract'),
      keywords: textsNS(el, OWS_NS, 'Keyword'),
      metadataURLs: Array.from(el.getElementsByTagNameNS(OWS_NS, 'Metadata')).map(m => ({
        href: attr(m, 'xlink:href') || attr(m, 'href') || ''
      }))
    };
  }
  // Para WCS 1.1.1 (CoverageOfferingBrief)
  // Namespace: http://www.opengis.net/wcs
  // keywords pode estar em <Keywords> ou <wcs:Keywords> e pode ser string única ou múltiplos <Keyword>
  let keywords: string[] = [];
  const kwEl =
    el.getElementsByTagName('wcs:Keywords')[0] ||
    el.getElementsByTagName('Keywords')[0] ||
    el.getElementsByTagName('ows:Keywords')[0];
  if (kwEl) {
    // Busca <Keyword>, <wcs:Keyword> e <ows:Keyword>
    const kwNodes = [
      ...Array.from(kwEl.getElementsByTagName('wcs:Keyword')),
      ...Array.from(kwEl.getElementsByTagName('Keyword')),
      ...Array.from(kwEl.getElementsByTagName('ows:Keyword'))
    ];
    if (kwNodes.length > 0) {
      keywords = kwNodes.map(k => k.textContent?.trim() || '').filter(Boolean);
    } else {
      keywords = (kwEl.textContent || '').split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return {
    identifier: textOf(el.getElementsByTagName('wcs:Identifier')[0]) || textOf(el.getElementsByTagName('Identifier')[0]) || '',
    title: textOf(el.getElementsByTagName('wcs:Title')[0]) || textOf(el.getElementsByTagName('Title')[0]),
    abstract: textOf(el.getElementsByTagName('wcs:Abstract')[0]) || textOf(el.getElementsByTagName('Abstract')[0]),
    keywords,
    metadataURLs: [],
    // boundingBox, nativeCRS, formats podem ser expandidos se necessário
  };
}

function parseSummary(doc: Document, version: string): IWCSSummary | undefined {
  // WCS 2.0.1: <wcs:CoverageDescriptions> ou <wcs:CoverageSummary>
  if (version.startsWith('2.')) {
    const wcsMetadata = doc.getElementsByTagNameNS(WCS_SERVICE_NS, 'wcsMetadata')[0];
    if (!wcsMetadata) return undefined;
    const coverages = Array.from(
      wcsMetadata.getElementsByTagNameNS(WCS_SERVICE_NS, 'CoverageDescription')
    ).map(el => parseCoverageDescription(el as Element, version));
    return {
      title: 'Coverage Offerings',
      coverages
    };
  }
  // WCS 1.1.1: <wcs:CoverageSummary> ou <wcs:CoverageOfferingBrief> dentro de <wcs:Contents>
  // Namespace: http://www.opengis.net/wcs
  const contents = doc.getElementsByTagName('wcs:Contents')[0] || doc.getElementsByTagName('Contents')[0];
  let coverages: IWCSCoverageDescription[] = [];
  if (contents) {
    // <wcs:CoverageSummary>
    coverages = Array.from(contents.getElementsByTagName('wcs:CoverageSummary')).map(el => parseCoverageDescription(el as Element, version));
    // <wcs:CoverageOfferingBrief>
    if (coverages.length === 0) {
      coverages = Array.from(contents.getElementsByTagName('wcs:CoverageOfferingBrief')).map(el => parseCoverageDescription(el as Element, version));
    }
  } else {
    // fallback: buscar <wcs:CoverageSummary> ou <wcs:CoverageOfferingBrief> no doc inteiro
    coverages = Array.from(doc.getElementsByTagName('wcs:CoverageSummary')).map(el => parseCoverageDescription(el as Element, version));
    if (coverages.length === 0) {
      coverages = Array.from(doc.getElementsByTagName('wcs:CoverageOfferingBrief')).map(el => parseCoverageDescription(el as Element, version));
    }
  }
  return {
    title: 'Coverage Offerings',
    coverages
  };
}

function parseOperationUrl(doc: Document, operationName: string): string | undefined {
  const operation = Array.from(doc.getElementsByTagNameNS('*', 'Operation'))
    .find((element) => element.getAttribute('name')?.toLowerCase() === operationName.toLowerCase());
  if (!operation) return undefined;
  const getElement = operation.getElementsByTagNameNS('*', 'Get')[0];
  return attr(getElement, 'xlink:href') || attr(getElement, 'href');
}

// Função principal de parsing
export function capabilities(xmlText: string): IWCSGetCapabilities {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const root = doc.documentElement;
  const version = attr(root, 'version') || '2.0.1';

  return {
    version,
    describeCoverageUrl: parseOperationUrl(doc, 'DescribeCoverage'),
    updateSequence: attr(root, 'updateSequence'),
    serviceIdentification: parseServiceIdentification(doc),
    serviceProvider: parseServiceProvider(doc),
    summary: parseSummary(doc, version)
  };
}

// Função para calcular estatísticas
export interface ICoverageStats {
  withIdentifier: number;
  withoutMetadata: number;
  withoutKeywords: number;
}

export function coverageStats(coverages: IWCSCoverageDescription[]): ICoverageStats {
  return {
    withIdentifier: coverages.filter(c => c.identifier).length,
    withoutMetadata: coverages.filter(c => !c.metadataURLs || c.metadataURLs.length === 0).length,
    withoutKeywords: coverages.filter(c => !c.keywords || c.keywords.length === 0).length
  };
}
