export type OGCServiceType = 'WMS' | 'WFS' | 'WCS' | string;

export interface OGCProcessRecord {
  id: number;
  serviceType: OGCServiceType;
  operation: string;
  datetime: string; // ISO string
  requestTimeSeconds: number;
  name: string;
  numLayers: number;
  numLayersWithoutMetadata: number;
  numLayersWithoutKeywords: number;
  url: string;
  processadoSemErro: boolean;
}
