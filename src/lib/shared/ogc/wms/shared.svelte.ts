import type {IWMSCapabilities} from '$lib/ogc/wms/wmsCapabilities';
export const counterWMS = $state<{ totalLayers: number,  totalLayersWithoutMetadata: number, totalWMSProcessado: number, countWMSProcessado: number, currentWMSCapability: IWMSCapabilities | null }>
({ totalLayers: 0, 
    totalLayersWithoutMetadata: 0, 
    totalWMSProcessado: 0, 
    countWMSProcessado: 0, 
    currentWMSCapability: null });    
