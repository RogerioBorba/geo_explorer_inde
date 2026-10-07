import type { IFeatureType } from '#lib/ogc/wfs/wfsCapabilities';
import type { IWMSLayer, IWMSStyle } from '#lib/ogc/wms/wmsCapabilities';
import { v4 as uuid } from 'uuid';

export class LayerOL {
    readonly className: string;
    id: string;
    name: string;
    type: 'WMS' | 'WFS' | 'GeoJSON' | 'OGCFeatures';
    layer: any | null;
    visible: boolean;
    opacity: number;
    zIndex: number;
    metadata?: any;
    url: string | null;
    constructor(name: string , type: any, layer: any, visiable: boolean, opacity: number, zIndex: number, metadata: any, url: string) {
      this.className = this.constructor.name;
      this.id = uuid();
      this.name = name;
      this.type = type;
      this.layer = layer;
      this.visible = visiable;
      this.opacity = opacity;
      this.zIndex = zIndex;
      this.metadata = metadata;
      this.url = url;
    }

};

export class WMSLayerOL extends LayerOL {
 wms?: { version: string; projection: string; format: string; style: string; serviceId: string; origem: string; legenda?: string };
 title : string; 
 styles: IWMSStyle[];
  constructor(iwmsLayer: IWMSLayer, url: string) {
    const aName = iwmsLayer.name || 'Sem nome';
    super(aName, 'WMS', null, true, 1, -1, iwmsLayer.metadataURLs[0], url);
    this.title = iwmsLayer.title || iwmsLayer.name || 'Sem nome e título';
    this.styles = iwmsLayer.styles; //.flatMap( style => style.legendURLs).map(legendIRL => legendIRL.href)
  }
};

export class WFSLayerOL extends LayerOL {
   title : string; 
  constructor(iwfsLayer: IFeatureType, url: string) {
    const aName = iwfsLayer.name || 'Sem nome';
    const metadata_url = iwfsLayer.metadataURLs && iwfsLayer.metadataURLs.length > 0 ? iwfsLayer.metadataURLs[0] : null;
    super(aName, 'WFS', null, true, 1, -1, metadata_url, url);
    this.title = iwfsLayer.title || iwfsLayer.name || 'Sem nome e título';
  }
};
