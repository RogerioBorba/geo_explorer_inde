// ----------------------------------------------------------------------
// Namespaces OGC
// ----------------------------------------------------------------------

const OWS_NS = "http://www.opengis.net/ows/1.1";
const OWS_1_0_NS = "http://www.opengis.net/ows";
const WFS_NS = "http://www.opengis.net/wfs";
const FES_NS = "http://www.opengis.net/fes/2.0";

// ----------------------------------------------------------------------
// Helpers namespace-safe
// ----------------------------------------------------------------------

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
    .map(el => el.textContent?.trim() || "")
    .filter(Boolean);
}

function firstLocal(
  parent: Element | Document,
  tag: string
): Element | undefined {
  return Array.from(parent.getElementsByTagName(tag))[0];
}

// ----------------------------------------------------------------------
// Tipos base e utilitários
// ----------------------------------------------------------------------

export interface IBoundingBox {
  lowerCorner: [number, number];
  upperCorner: [number, number];
}

export interface IKeyword {
  value: string;
}

export interface IMetadataUrl {
  type?: string;
  format?: string;
  href: string;
}

function text(el?: Element | null): string | undefined {
  return el?.textContent?.trim() || undefined;
}

// ----------------------------------------------------------------------
// Seções principais
// ----------------------------------------------------------------------

export interface IServiceIdentification {
  title: string;
  abstract?: string;
  keywords?: string[];
  serviceType?: string;
  serviceTypeVersion?: string;
  fees?: string;
  accessConstraints?: string;
}

export interface IServiceProvider {
  providerName: string;
  contactEmail?: string;
  city?: string;
  country?: string;
  administrativeArea?: string;
}

export interface IOperation {
  name: string;
  getUrl?: string;
  postUrl?: string;
  parameters?: Record<string, string[]>;
  constraints?: Record<string, string>;
}

export interface IFeatureType {
  name: string;
  title: string;
  abstract?: string;
  keywords?: string[];
  defaultCRS?: string;
  bbox?: IBoundingBox;
  metadataURLs?: IMetadataUrl[];
}

export interface IFESConstraint {
  name: string;
  defaultValue?: string;
}

export interface IFESComparisonOperator {
  name: string;
}

export interface IFESSpatialOperator {
  name: string;
}

export interface IFESTemporalOperator {
  name: string;
}

export interface IFESFunctionArgument {
  name: string;
  type: string;
}

export interface IFESFunction {
  name: string;
  returns: string;
  arguments: IFESFunctionArgument[];
}

export interface IFilterCapabilities {
  conformance: IFESConstraint[];
  idCapabilities: string[];
  comparisonOperators: IFESComparisonOperator[];
  spatialOperators: IFESSpatialOperator[];
  temporalOperators: IFESTemporalOperator[];
  functions: IFESFunction[];
}

// ----------------------------------------------------------------------
// Estrutura principal
// ----------------------------------------------------------------------

export interface IWFSGetCapabilities {
  version: string;
  updateSequence?: string;
  serviceIdentification: IServiceIdentification;
  serviceProvider: IServiceProvider;
  operations: IOperation[];
  featureTypes: IFeatureType[];
  filterCapabilities?: IFilterCapabilities;
}

// ----------------------------------------------------------------------
// Função de parser principal
// ----------------------------------------------------------------------

export function parseWFSGetCapabilities(xml: Document): IWFSGetCapabilities {
  const version = xml.documentElement.getAttribute("version") ?? "";
  const updateSequence = xml.documentElement.getAttribute("updateSequence") ?? undefined;

  // ------------------ ServiceIdentification ------------------
  const serviceEl = xml.querySelector("ows\\:ServiceIdentification, ServiceIdentification");
  const serviceIdentification: IServiceIdentification = {
    title: text(serviceEl?.querySelector("ows\\:Title")) ?? "",
    abstract: text(serviceEl?.querySelector("ows\\:Abstract")),
    keywords: Array.from(serviceEl?.querySelectorAll("ows\\:Keyword") ?? []).map(k => text(k) ?? ""),
    serviceType: text(serviceEl?.querySelector("ows\\:ServiceType")),
    serviceTypeVersion: text(serviceEl?.querySelector("ows\\:ServiceTypeVersion")),
    fees: text(serviceEl?.querySelector("ows\\:Fees")),
    accessConstraints: text(serviceEl?.querySelector("ows\\:AccessConstraints")),
  };

  // ------------------ ServiceProvider ------------------
  const providerEl = xml.querySelector("ows\\:ServiceProvider, ServiceProvider");
  const serviceProvider: IServiceProvider = {
    providerName: text(providerEl?.querySelector("ows\\:ProviderName")) ?? "",
    contactEmail: text(providerEl?.querySelector("ows\\:ElectronicMailAddress")),
    city: text(providerEl?.querySelector("ows\\:City")),
    country: text(providerEl?.querySelector("ows\\:Country")),
    administrativeArea: text(providerEl?.querySelector("ows\\:AdministrativeArea")),
  };

  // ------------------ OperationsMetadata ------------------
  const operations: IOperation[] = Array.from(xml.querySelectorAll("ows\\:Operation")).map(op => ({
    name: op.getAttribute("name") ?? "",
    getUrl: op.querySelector("ows\\:Get")?.getAttribute("xlink:href") ?? undefined,
    postUrl: op.querySelector("ows\\:Post")?.getAttribute("xlink:href") ?? undefined,
    parameters: Object.fromEntries(
      Array.from(op.querySelectorAll("ows\\:Parameter")).map(p => [
        p.getAttribute("name") ?? "",
        Array.from(p.querySelectorAll("ows\\:Value")).map(v => text(v) ?? "")
      ])
    ),
    constraints: Object.fromEntries(
      Array.from(op.querySelectorAll("ows\\:Constraint")).map(c => [
        c.getAttribute("name") ?? "",
        text(c.querySelector("ows\\:DefaultValue")) ?? ""
      ])
    )
  }));

  function parseKeywords(parentEl: Element): string[] {
  const isSupportedOWSNamespace = (namespace: string | null) =>
    namespace === OWS_NS || namespace === OWS_1_0_NS || namespace === WFS_NS || namespace === null;
  const keywordsEl = Array.from(parentEl.children)
    .find(el => el.localName === "Keywords" && isSupportedOWSNamespace(el.namespaceURI));

  if (!keywordsEl) return [];

  return Array.from(keywordsEl.children)
    .filter(el => el.localName === "Keyword" && isSupportedOWSNamespace(el.namespaceURI))
    .map(el => el.textContent?.trim() || "");
};


  // ------------------ FeatureTypeList ------------------
  const featureTypes: IFeatureType[] = Array.from(xml.getElementsByTagNameNS("*", "FeatureType")).map(ft => {
    const child = (localName: string) => Array.from(ft.children).find(el => el.localName === localName);
    const lowerCorner = text(child("WGS84BoundingBox")?.getElementsByTagNameNS("*", "LowerCorner")[0]);
    const upperCorner = text(child("WGS84BoundingBox")?.getElementsByTagNameNS("*", "UpperCorner")[0]);
    const legacyBox = child("LatLongBoundingBox");
    const legacyBounds = legacyBox ? {
      lowerCorner: [Number(legacyBox.getAttribute("minx")), Number(legacyBox.getAttribute("miny"))] as [number, number],
      upperCorner: [Number(legacyBox.getAttribute("maxx")), Number(legacyBox.getAttribute("maxy"))] as [number, number],
    } : undefined;
    return {
      name: text(child("Name")) ?? "",
      title: text(child("Title")) ?? "",
      abstract: text(child("Abstract")),
      keywords: parseKeywords(ft), //Array.from(ft.querySelectorAll(":scope > Keywords > Keyword")).map(k => text(k) ?? ""),
      defaultCRS: text(child("DefaultCRS")) ?? text(child("DefaultSRS")) ?? text(child("SRS")),
      bbox: lowerCorner && upperCorner
        ? {
            lowerCorner: lowerCorner.split(/\s+/).map(Number) as [number, number],
            upperCorner: upperCorner.split(/\s+/).map(Number) as [number, number],
          }
        : legacyBounds,
      metadataURLs: Array.from(ft.querySelectorAll("MetadataURL")).map(m => ({
        type: m.getAttribute("type") ?? undefined,
        format: text(m.querySelector("Format")),
        href: m.getAttribute("xlink:href") ?? "",
      })),
    };
  });

  // ------------------ Filter_Capabilities (FES 2.0) ------------------
  const filterEl = xml.querySelector("fes\\:Filter_Capabilities");
  let filterCapabilities: IFilterCapabilities | undefined;

  if (filterEl) {
    // Conformance constraints
    const conformance: IFESConstraint[] = Array.from(filterEl.querySelectorAll("fes\\:Conformance > fes\\:Constraint"))
      .map(c => ({
        name: c.getAttribute("name") ?? "",
        defaultValue: text(c.querySelector("ows\\:DefaultValue")),
      }));

    // Id_Capabilities
    const idCapabilities = Array.from(filterEl.querySelectorAll("fes\\:Id_Capabilities fes\\:ResourceIdentifier"))
      .map(id => id.getAttribute("name") ?? "");

    // ComparisonOperators
    const comparisonOperators = Array.from(filterEl.querySelectorAll("fes\\:ComparisonOperators fes\\:ComparisonOperator"))
      .map(op => ({ name: op.getAttribute("name") ?? "" }));

    // SpatialOperators
    const spatialOperators = Array.from(filterEl.querySelectorAll("fes\\:SpatialOperators fes\\:SpatialOperator"))
      .map(op => ({ name: op.getAttribute("name") ?? "" }));

    // TemporalOperators
    const temporalOperators = Array.from(filterEl.querySelectorAll("fes\\:TemporalOperators fes\\:TemporalOperator"))
      .map(op => ({ name: op.getAttribute("name") ?? "" }));

    // Functions
    const functions = Array.from(filterEl.querySelectorAll("fes\\:Functions fes\\:Function")).map(f => ({
      name: f.getAttribute("name") ?? "",
      returns: text(f.querySelector("fes\\:Returns")) ?? "",
      arguments: Array.from(f.querySelectorAll("fes\\:Argument")).map(arg => ({
        name: arg.getAttribute("name") ?? "",
        type: text(arg.querySelector("fes\\:Type")) ?? "",
      })),
    }));

    filterCapabilities = {
      conformance,
      idCapabilities,
      comparisonOperators,
      spatialOperators,
      temporalOperators,
      functions,
    };
  }

  // ------------------ Retorno completo ------------------
  return {
    version,
    updateSequence,
    serviceIdentification,
    serviceProvider,
    operations,
    featureTypes,
    filterCapabilities,
  };
};

export function iWFSFeatureTypes(xmlString: string): IFeatureType[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const iwfs_capabilties = parseWFSGetCapabilities(xmlDoc);
  let layers: IFeatureType[] = iwfs_capabilties.featureTypes;
  return layers
};

export function capabilities(xmlString: string): IWFSGetCapabilities {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const iwfs_capabilties = parseWFSGetCapabilities(xmlDoc);
  return iwfs_capabilties
};

export interface ILayerStats {
  withName: number;
  withNameWithoutMetadata: number;
  withNameWithoutKeywords: number;
};

export function layerStats(layers: IFeatureType[]): ILayerStats {
  const stats: ILayerStats = {
    withName: 0,
    withNameWithoutMetadata: 0,
    withNameWithoutKeywords: 0,
  };
  for (const layer of layers) {
      
        stats.withName++;
        if (!layer.metadataURLs || layer.metadataURLs.length === 0) {
          stats.withNameWithoutMetadata++;
        }
        console.log("Layer  keywords: " + layer.keywords);
        if (!layer.keywords || layer.keywords.length === 0) {
          
          stats.withNameWithoutKeywords++;
        }   
  }
  return stats;
};
// ----------------------------------------------------------------------
// Exemplo de uso
// ----------------------------------------------------------------------
// const xmlDoc = new DOMParser().parseFromString(xmlString, "text/xml");
// const capabilities = parseWFSGetCapabilities(xmlDoc);
// console.log(capabilities);
