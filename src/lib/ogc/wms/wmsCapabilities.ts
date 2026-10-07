import { parseDocumentoWMS } from './descoberta';
// ----------------------------------------------------------------------
// Interfaces principais do WMS GetCapabilities 1.3.0
// ----------------------------------------------------------------------
export interface IWMSOnlineResource {
  href: string;
  type?: string;
  format?: string;
}

export interface IWMSMetadataURL {
  type?: string;
  format?: string;
  href: string;
}

export interface IWMSContactInformation {
  person?: string;
  organization?: string;
  position?: string;
  address?: string;
  city?: string;
  stateOrProvince?: string;
  postCode?: string;
  country?: string;
  email?: string;
}

export interface IWMSService {
  name: string;
  title: string;
  abstract?: string;
  keywords: string[];
  onlineResource?: IWMSOnlineResource;
  contactInformation?: IWMSContactInformation;
  fees?: string;
  accessConstraints?: string;
}

export interface IWMSRequestType {
  name: string;
  formats: string[];
  getURLs: string[];
  postURLs: string[];
}

export interface IWMSCapability {
  requests: IWMSRequestType[];
  exceptions: string[];
  layers: IWMSLayer[];
}

export interface IWMSBoundingBox {
  crs: string;
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface IWMSGeographicBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface IWMSLegendURL {
  format: string;
  width?: number;
  height?: number;
  href: string;
}

export interface IWMSStyle {
  name: string;
  title?: string;
  abstract?: string;
  legendURLs: IWMSLegendURL[];
}

export interface IWMSLayer {
  queryable?: boolean;
  name?: string;
  title: string;
  abstract?: string;
  keywords?: string[];
  crs: string[];
  bbox?: IWMSBoundingBox[];
  geographicBoundingBox?: IWMSGeographicBoundingBox;
  styles: IWMSStyle[];
  metadataURLs: IWMSMetadataURL[];
  layers: IWMSLayer[]; // subcamadas
}

export interface IWMSCapabilities {
  version: string;
  updateSequence?: string;
  service: IWMSService;
  capability: IWMSCapability;
}

// ----------------------------------------------------------------------
// Funções utilitárias
// ----------------------------------------------------------------------

function textOf(el: Element | null): string | undefined {
  return el?.textContent?.trim() || undefined;
}

function parseOnlineResource(el: Element | null): IWMSOnlineResource | undefined {
  if (!el) return undefined;
  const href = el.getAttribute("xlink:href") || "";
  const type = el.getAttribute("xlink:type") || undefined;
  return { href, type };
}

function parseMetadataURLs(layerEl: Element): IWMSMetadataURL[] {
  return Array.from(layerEl.querySelectorAll(":scope > MetadataURL")).map(metaEl => ({
    type: metaEl.getAttribute("type") || undefined,
    format: textOf(metaEl.querySelector(":scope > Format")),
    href: metaEl.querySelector(":scope > OnlineResource")?.getAttribute("xlink:href") || "",
  }));
}

function parseKeywords(parentEl: Element): string[] {
  return Array.from(
    parentEl.querySelectorAll(":scope > KeywordList > Keyword")
  ).map(k => k.textContent?.trim() || "");
}

// ----------------------------------------------------------------------
// Função principal: parser de WMS GetCapabilities
// ----------------------------------------------------------------------

export function parseWMSCapabilities(xml: Document): IWMSCapabilities {
  return parseDocumentoWMS(xml);
}

export function iWMSLayers(xmlString: string): IWMSLayer[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const iwms_capabilties = parseWMSCapabilities(xmlDoc);
  let layers: IWMSLayer[] = iwms_capabilties.capability.layers;
  return layers
};

export function iWMSCapabilities(xmlString: string): IWMSCapabilities {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const iwms_capabilties = parseWMSCapabilities(xmlDoc);
  return iwms_capabilties;
};


export interface IWMSLayerStats {
  withName: number;
  withNameWithoutMetadata: number;
  withNameWithoutKeywords: number;
};

export interface IWMSKeywordStats {
  countTotalLayer: number; 
  countWMSProcessado: number; 
  allKeywords: string[];
  keywordCountByName: Record<string, number>;
};

export function countWMSLayers(layers: IWMSLayer[]): IWMSLayerStats {
  const stats: IWMSLayerStats = {
    withName: 0,
    withNameWithoutMetadata: 0,
    withNameWithoutKeywords: 0,
  };

  function visit(layer: IWMSLayer) {
    const hasName = layer.name !== undefined && layer.name !== null;

    if (hasName) { // conta apenas layers com nome. Camadas sem nome são grupos(LayerGroups)
      stats.withName++;

      if (!layer.metadataURLs || layer.metadataURLs.length === 0) {
        stats.withNameWithoutMetadata++;
      }

      if (!layer.keywords || layer.keywords.length === 0) {
        stats.withNameWithoutKeywords++;
      }
    }

    // percorre sublayers
    if (layer.layers && layer.layers.length > 0) {
      layer.layers.forEach(visit);
    }
  }

  layers.forEach(visit);

  return stats;
}

export function layersAndGroupKayers(layer: IWMSLayer): IWMSLayer[] {
    let layers: IWMSLayer[] = [];
    
    subLayers(layer);
    // percorre sublayers
    function subLayers(layer: IWMSLayer): void {
      
      if (layer.layers && layer.layers.length > 0) {
        layer.layers.forEach(subLayers);
      } 
      layers.push(layer);
    }
    
    return layers;
}
