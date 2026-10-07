import type { IFeatureType, IMetadataUrl } from "$lib/ogc/wfs/wfsCapabilities";

export class WFSLayer {
  static readonly GEOJSON_CRS = "EPSG:4326";
  static readonly DEFAULT_VERSION = "2.0.0";
  static readonly SUPPORTED_VERSIONS = new Set(["1.0.0", "1.1.0", "2.0.0"]);
  iwfsLayer: IFeatureType;
  url: string;
  version: string;
  tipoGeometria: string;

  constructor(
    iwfsLayer: IFeatureType,
    capabilitiesUrl: string,
    version?: string
  ) {
    this.iwfsLayer = iwfsLayer;

    // URL base (sem query string)
    const urlObj = new URL(capabilitiesUrl);
    this.url = `${urlObj.origin}${urlObj.pathname}`;

    // versão: prioridade
    // 1) parâmetro explícito
    // 2) parâmetro version da URL do GetCapabilities
    // 3) fallback
    const requestedVersion =
      version ||
      urlObj.searchParams.get("version") ||
      WFSLayer.DEFAULT_VERSION;
    this.version = WFSLayer.SUPPORTED_VERSIONS.has(requestedVersion)
      ? requestedVersion
      : WFSLayer.DEFAULT_VERSION;

    this.tipoGeometria = "";
  }

  description(): string {
    return this.iwfsLayer.title || this.iwfsLayer.name;
  }

  keywords(): string[] {
    return this.iwfsLayer.keywords || [];
  }

  metadataURLs(): IMetadataUrl[] {
    return this.iwfsLayer?.metadataURLs || [];
  }

  name(): string {
    return this.iwfsLayer.name;
  }

  title(): string {
    return this.iwfsLayer.title || "";
  }

  // =========================
  // Helpers internos
  // =========================

  private typeNameParam(version: string): string {
    // WFS 2.0.0 -> typeNames
    // WFS 1.1.0 / 1.0.0 -> typeName
    return version.startsWith("2.") ? "typeNames" : "typeName";
  }

  // =========================
  // URLs WFS
  // =========================

  urlGetFeatureBase(version: string = this.version): string {
    const service = "WFS";
    const request = "GetFeature";
    const typeNameParam = this.typeNameParam(version);
    const typeName = this.name();
    // GeoJSON is the interchange format used by the viewer. Request it in a
    // projection OpenLayers supports natively instead of relying on each
    // service's default CRS (for example, SIRGAS 2000 / EPSG:4674).
    const srsName = WFSLayer.GEOJSON_CRS;

    const baseUrl = `${this.url}?service=${service}&version=${version}&request=${request}&${typeNameParam}=${typeName}`;
    return srsName ? `${baseUrl}&srsName=${encodeURIComponent(srsName)}` : baseUrl;
  }

  urlGetFeature(version: string = this.version,outputFormat: string = "application/json"): string {
    const baseURL = this.urlGetFeatureBase(version);
    return `${baseURL}&outputFormat=${outputFormat}`;
  }

  urlGetFeatureCount(version: string = this.version, outputFormat: string = "GML2" ): string | null {
    if (version =="1.0.0") {
      // WFS 1.0.0 não suporta resultType=hits
      //return this.urlGetFeatureBase(version) + `&outputFormat=${outputFormat}`;
      return null; // Indica que a contagem de feições não é suportada para esta versão
    }
    const baseURL = this.urlGetFeatureBase(version);
    return `${baseURL}&outputFormat=${outputFormat}&resultType=hits`;
  }
}
