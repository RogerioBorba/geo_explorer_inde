import { layerManager } from './shared.svelte';
import { WMSLayerOL } from '#lib/components/openlayers/layerOL';
import type { CamadaDescoberta } from '#lib/ogc/wms/descoberta';
import type { IWMSCapabilities } from '#lib/ogc/wms/wmsCapabilities';
import type { CatalogoWMS } from '#lib/inde/catalogos';

export function adicionarWMS(camada: CamadaDescoberta, documento: IWMSCapabilities, catalogo: CatalogoWMS) {
  const id = `${catalogo.capabilitiesUrl}#${encodeURIComponent(camada.nome)}`;
  if (layerManager.selectedLayers.some(entry => entry.id === id)) return;
  const operation = documento.capability.requests.find(item => item.name === 'GetMap');
  const endpoint = operation?.getURLs[0];
  const projection = ['EPSG:3857', 'EPSG:4326', 'CRS:84'].find(crs => camada.modelo.crs.includes(crs));
  const format = ['image/png', 'image/jpeg'].find(item => operation?.formats.includes(item));
  if (!endpoint || !projection || !format) throw new Error('Esta camada não anuncia formato ou projeção compatível para visualização.');
  const entry = new WMSLayerOL(camada.modelo, endpoint);
  entry.id = id;
  entry.wms = { version: documento.version, projection, format, style: '', serviceId: catalogo.capabilitiesUrl, origem: catalogo.titulo };
  const legend = documento.capability.requests.find(item => item.name === 'GetLegendGraphic');
  if (legend?.getURLs[0] && legend.formats.includes('image/png')) {
    const url = new URL(legend.getURLs[0]);
    url.searchParams.set('SERVICE', 'WMS'); url.searchParams.set('REQUEST', 'GetLegendGraphic');
    url.searchParams.set('FORMAT', 'image/png'); url.searchParams.set('LAYER', entry.name);
    url.searchParams.delete('STYLE');
    url.searchParams.set('VERSION', documento.version);
    entry.wms.legenda = url.href;
  }
  layerManager.selectedLayers.push(entry);
}

export function removerWMS(id: string) {
  layerManager.selectedLayers = layerManager.selectedLayers.filter(entry => entry.id !== id);
}
