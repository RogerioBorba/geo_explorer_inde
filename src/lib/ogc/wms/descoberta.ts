import type { IWMSCapabilities, IWMSLayer, IWMSStyle, IWMSRequestType } from './wmsCapabilities';

export interface CamadaDescoberta { nome: string; titulo: string; resumo: string; grupos: string[]; metadados: string[]; modelo: IWMSLayer; }

export function urlPublica(value: string, base?: string): string | undefined {
  if (!value.trim()) return undefined;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

export function parseDocumentoWMS(document: Document, base?: string): IWMSCapabilities {
  const root = document.documentElement;
  if (document.getElementsByTagName('parsererror').length || !['WMS_Capabilities', 'WMT_MS_Capabilities'].includes(root.localName)) throw new Error('O serviço não retornou um documento WMS válido.');
  const children = (element: Element | undefined, name: string) => Array.from(element?.children ?? []).filter(item => item.localName === name);
  const child = (element: Element | undefined, name: string) => children(element, name)[0];
  const text = (element: Element | undefined, name: string) => child(element, name)?.textContent?.trim() ?? '';
  const href = (element: Element | undefined) => urlPublica(element?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || element?.getAttribute('xlink:href') || element?.getAttribute('href') || '', base);
  const capability = child(root, 'Capability');
  if (!capability) throw new Error('O documento WMS não contém as capacidades do serviço.');
  const requests: IWMSRequestType[] = Array.from(child(capability, 'Request')?.children ?? []).map(element => ({
    name: element.localName, formats: children(element, 'Format').map(item => item.textContent?.trim() ?? ''),
    getURLs: children(element, 'DCPType').flatMap(dcp => children(child(dcp, 'HTTP'), 'Get').flatMap(get => { const url = href(child(get, 'OnlineResource')); return url ? [url] : []; })), postURLs: []
  }));
  function layer(element: Element, parent?: IWMSLayer): IWMSLayer {
    const styles: IWMSStyle[] = children(element, 'Style').map(style => ({ name: text(style, 'Name'), title: text(style, 'Title'), legendURLs: children(style, 'LegendURL').flatMap(legend => {
      const url = href(child(legend, 'OnlineResource')); return url ? [{ href: url, format: text(legend, 'Format') }] : [];
    }) }));
    const inheritedStyles = new Map((parent?.styles ?? []).map(style => [style.name, style]));
    for (const style of styles) if (!inheritedStyles.has(style.name)) inheritedStyles.set(style.name, style);
    const geographic = child(element, 'EX_GeographicBoundingBox');
    const legacyBox = child(element, 'LatLonBoundingBox');
    const geographicBoundingBox = geographic ? { west: Number(text(geographic, 'westBoundLongitude')), south: Number(text(geographic, 'southBoundLatitude')), east: Number(text(geographic, 'eastBoundLongitude')), north: Number(text(geographic, 'northBoundLatitude')) } : legacyBox ? { west: Number(legacyBox.getAttribute('minx')), south: Number(legacyBox.getAttribute('miny')), east: Number(legacyBox.getAttribute('maxx')), north: Number(legacyBox.getAttribute('maxy')) } : parent?.geographicBoundingBox;
    const boxes = new Map((parent?.bbox ?? []).map(box => [box.crs, box]));
    for (const box of children(element, 'BoundingBox')) {
      const crs = box.getAttribute('CRS') || box.getAttribute('SRS') || '';
      boxes.set(crs, { crs, minx: Number(box.getAttribute('minx')), miny: Number(box.getAttribute('miny')), maxx: Number(box.getAttribute('maxx')), maxy: Number(box.getAttribute('maxy')) });
    }
    const result: IWMSLayer = {
      name: text(element, 'Name') || undefined, title: text(element, 'Title') || text(element, 'Name'), abstract: text(element, 'Abstract'),
      crs: [...new Set([...(parent?.crs ?? []), ...[...children(element, 'CRS'), ...children(element, 'SRS')].flatMap(item => (item.textContent ?? '').trim().split(/\s+/).filter(Boolean))])],
      queryable: element.hasAttribute('queryable') ? ['1', 'true'].includes(element.getAttribute('queryable') ?? '') : parent?.queryable ?? false,
      styles: [...inheritedStyles.values()], bbox: [...boxes.values()], geographicBoundingBox,
      metadataURLs: children(element, 'MetadataURL').flatMap(meta => { const url = href(child(meta, 'OnlineResource')); return url ? [{ href: url, type: meta.getAttribute('type') ?? undefined, format: text(meta, 'Format') }] : []; }),
      keywords: children(child(element, 'KeywordList'), 'Keyword').map(item => item.textContent?.trim() ?? ''), layers: []
    };
    result.layers = children(element, 'Layer').map(item => layer(item, result));
    return result;
  }
  const service = child(root, 'Service');
  return { version: root.getAttribute('version') || '1.3.0', service: { name: text(service, 'Name'), title: text(service, 'Title'), abstract: text(service, 'Abstract'), keywords: children(child(service, 'KeywordList'), 'Keyword').map(item => item.textContent?.trim() ?? '') }, capability: { requests, exceptions: children(child(capability, 'Exception'), 'Format').map(item => item.textContent?.trim() ?? ''), layers: children(capability, 'Layer').map(item => layer(item)) } };
}

export function filtrarCamadas(camadas: CamadaDescoberta[], busca: string): CamadaDescoberta[] {
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const termo = normalizar(busca.trim());
  return camadas.filter(camada => normalizar(camada.titulo).includes(termo) || normalizar(camada.nome).includes(termo));
}

/** Mantém os ancestrais dos resultados, sem transformar grupos em camadas adicionáveis. */
export function filtrarArvoreWMS(camadas: IWMSLayer[], busca: string): IWMSLayer[] {
  if (!busca.trim()) return camadas;
  return camadas.flatMap(camada => {
    const layers = filtrarArvoreWMS(camada.layers, busca);
    const match = camada.name && filtrarCamadas([{ nome: camada.name, titulo: camada.title, resumo: '', grupos: [], metadados: [], modelo: camada }], busca).length;
    return match || layers.length ? [{ ...camada, layers }] : [];
  });
}

export function lerCapabilities(xml: string, base?: string): IWMSCapabilities {
  return parseDocumentoWMS(new DOMParser().parseFromString(xml, 'application/xml'), base);
}

export function listarCamadasWMS(xml: string, base?: string): CamadaDescoberta[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return camadasDoDocumento(parseDocumentoWMS(document, base));
}

export function camadasDoDocumento(document: IWMSCapabilities): CamadaDescoberta[] {
  const result: CamadaDescoberta[] = [];
  function visit(layer: IWMSLayer, grupos: string[]) {
    if (layer.name) result.push({ nome: layer.name, titulo: layer.title, resumo: layer.abstract ?? '', grupos, metadados: layer.metadataURLs.map(meta => meta.href), modelo: layer });
    for (const sublayer of layer.layers) visit(sublayer, layer.title ? [...grupos, layer.title] : grupos);
  }
  for (const layer of document.capability.layers) visit(layer, []);
  return result;
}
