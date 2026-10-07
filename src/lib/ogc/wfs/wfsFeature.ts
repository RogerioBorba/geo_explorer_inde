// ----------------------------------------------------------------------
// Subtipos auxiliares
// ----------------------------------------------------------------------
export interface IBoundingBox {
  crs?: string;
  lowerCorner: [number, number];
  upperCorner: [number, number];
}

export interface IMetadataUrl {
  type?: string;
  format?: string;
  href: string;
}

export interface IKeyword {
  keyword: string[];
}

export interface IOperation {
  name: string;
  href?: string;
}

export interface IOutputFormat {
  format: string;
}

// ----------------------------------------------------------------------
// Interface consolidada (WFS 1.0.0 + 1.1.0 + 2.0.0)
// ----------------------------------------------------------------------
export interface IFeatureType {
  /** Nome único do FeatureType */
  name: string;

  /** Título legível */
  title?: string;

  /** Descrição textual */
  abstract?: string;

  /** Palavras-chave associadas */
  keywords?: string[] | IKeyword | IKeyword[];

  /** SRS (1.0) / DefaultSRS (1.1) / DefaultCRS (2.0) */
  srs?: string;
  defaultSrs?: string;
  defaultCrs?: string;

  /** Outros sistemas de referência suportados */
  otherSrs?: string[];
  otherCrs?: string[];

  /** Formatos de saída suportados */
  outputFormats?: string[] | IOutputFormat[];

  /** Operações aplicáveis (WFS 1.1+) */
  operations?: IOperation[];

  /** Extensão geográfica (WGS84BoundingBox / LatLongBoundingBox) */
  latLongBoundingBox?: IBoundingBox;
  wgs84BoundingBox?: IBoundingBox[];

  /** URLs de metadados */
  metadataUrl?: IMetadataUrl[];

  /** Descrição estendida (2.0) */
  extendedDescription?: string;

  /** Referência a outros metadados (2.0) */
  metadata?: string[];

  /** Indica ausência de CRS (2.0) */
  noCrs?: boolean;
}

// ----------------------------------------------------------------------
// FeatureTypeList (lista de FeatureType do GetCapabilities)
// ----------------------------------------------------------------------
export interface IFeatureTypeList {
  /** Lista de FeatureTypes */
  featureTypes: IFeatureType[];

  /** Possíveis operações suportadas (WFS 2.0) */
  operations?: IOperation[];

  /** Nome ou identificador do serviço (opcional em 1.0/1.1) */
  service?: string;
}

// Função auxiliar para extrair texto de um elemento
function textOf(el?: Element | null): string | undefined {
  return el?.textContent?.trim() || undefined;
}

// Função auxiliar para extrair múltiplos valores de <ows:Keyword>
function parseKeywords(layer: Element): string[] {
  return Array.from(layer.querySelectorAll('ows\\:Keyword'))
    .map(k => textOf(k))
    .filter(Boolean) as string[];
}

// Função auxiliar para extrair bounding box
function parseBoundingBox(el?: Element | null) {
  if (!el) return undefined;
  const lower = textOf(el.querySelector('ows\\:LowerCorner'))?.split(' ').map(Number);
  const upper = textOf(el.querySelector('ows\\:UpperCorner'))?.split(' ').map(Number);
  if (!lower || !upper || lower.length < 2 || upper.length < 2) return undefined;
  return {
    lowerCorner: [lower[0], lower[1]],
    upperCorner: [upper[0], upper[1]],
    crs: 'EPSG:4326',
  };
}

// Parser principal
export function parseWFSFeatureTypes(xml: Document): IFeatureType[] {
  const featureTypeNodes = xml.querySelectorAll('FeatureTypeList > FeatureType');
  const featureTypes: IFeatureType[] = [];

  featureTypeNodes.forEach(ft => {
    const name = textOf(ft.querySelector('Name'))!;
    const title = textOf(ft.querySelector('Title'));
    const abs = textOf(ft.querySelector('Abstract'));
    const defaultCrs = textOf(ft.querySelector('DefaultCRS'));
    const wgs84BoundingBoxEls = ft.querySelectorAll('ows\\:WGS84BoundingBox');
    const metadataUrls = Array.from(ft.querySelectorAll('MetadataURL')).map(m => ({
      href: m.getAttribute('xlink:href') || '',
      format: m.getAttribute('format') || undefined,
      type: m.getAttribute('type') || undefined,
    }));

    const wgs84BoundingBox = Array.from(wgs84BoundingBoxEls)
      .map(parseBoundingBox)
      .filter(Boolean);

    const keywords = parseKeywords(ft);

    featureTypes.push({
      name,
      title,
      abstract: abs,
      defaultCrs,
      keywords,
      wgs84BoundingBox: wgs84BoundingBox as any,
      metadataUrl: metadataUrls,
    });
  });

  return  featureTypes;
};

export function featureCounted(xmlDoc: Document): number {
  const numberMatchedAttr = xmlDoc.documentElement.getAttribute("numberMatched") || 
  xmlDoc.documentElement.getAttribute("numberOfFeatures") || '0';
  const numberMatched: number = parseInt(numberMatchedAttr, 10);
  return numberMatched;
};
