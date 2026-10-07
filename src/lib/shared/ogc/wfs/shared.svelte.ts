import type {IWFSGetCapabilities, IFeatureType} from '$lib/ogc/wfs/wfsCapabilities';

export const counterWFS = $state<
{   totalLayers: number,  
    totalLayersWithoutMetadata: number, 
    totalWFSProcessado: number, 
    countWFSProcessado: number, 
    currentCapability: IWFSGetCapabilities | null }>
({ totalLayers: 0, 
    totalLayersWithoutMetadata: 0, 
    totalWFSProcessado: 0, 
    countWFSProcessado: 0,
    currentCapability: null });

interface FeatureTypeDetail {
    name: string;
    title: string;
    abstract?: string;
    properties: Property[];
}

interface Property {
    name: string;
    type: string;
    minOccurs?: number;
    maxOccurs?: number | string;
}

export const wfsFeatureTypesData = $state<{
    catalogName: string;
    featureTypes: IFeatureType[];
    capabilitiesUrl: string;
}>({
    catalogName: '',
    featureTypes: [],
    capabilitiesUrl: ''
});
