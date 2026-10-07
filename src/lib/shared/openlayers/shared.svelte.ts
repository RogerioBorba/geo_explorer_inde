import Map from 'ol/Map.js';
import type { FacadeOL } from '#lib/components/openlayers/facade_openlayers';
import type { LayerOL } from '../../components/openlayers/layerOL';
export const mapper_ol = $state<{ map: Map | null, facadeOL: FacadeOL | null }>({ map: null, facadeOL: null});
export const layerManager = $state<{selectedLayers: LayerOL[]}>({selectedLayers:[]});
