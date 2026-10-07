import type { IWCSGetCapabilities } from '$lib/ogc/wcs/wcsCapabilities';

export const counterWCS = $state<{
    totalCoverages: number;
    totalCoveragesWithoutMetadata: number;
    totalWCSProcessado: number;
    countWCSProcessado: number;
    currentWCSCapability: IWCSGetCapabilities | null;
}>({
    totalCoverages: 0,
    totalCoveragesWithoutMetadata: 0,
    totalWCSProcessado: 0,
    countWCSProcessado: 0,
    currentWCSCapability: null
});
