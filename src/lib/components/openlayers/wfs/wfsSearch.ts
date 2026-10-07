import type { IBoundingBox, IFeatureType } from '$lib/ogc/wfs/wfsCapabilities';
import type { IGeoservicoDescricao } from '$lib/inde';

export type SearchOperator = 'OR' | 'AND';
export type GeographicBounds = { west: number; south: number; east: number; north: number };

export function hasWFSAvailable(
    catalog: IGeoservicoDescricao & { wfsAvailable?: boolean }
): boolean {
    return Boolean(catalog.wfsAvalaible ?? catalog.wfsAvailable);
}

export function hasWFSGetCapabilities(catalog: Pick<IGeoservicoDescricao, 'wfsGetCapabilities'>): boolean {
    return typeof catalog.wfsGetCapabilities === 'string' && catalog.wfsGetCapabilities.trim().length > 0;
}

export function normalizeSearchTerm(value: string): string {
    return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function parseSearchTerms(value: string): string[] {
    return value.split(/[\n,;]+/).map(normalizeSearchTerm).filter(Boolean);
}

export function matchesFeatureTypeKeywords(
    featureType: IFeatureType,
    terms: string[],
    operator: SearchOperator
): boolean {
    const keywords = (featureType.keywords ?? []).map(normalizeSearchTerm).filter(Boolean);
    if (keywords.length === 0 || terms.length === 0) return false;

    const matches = (term: string) => keywords.some((keyword) => keyword.includes(term));
    return operator === 'AND' ? terms.every(matches) : terms.some(matches);
}

export function geographicBounds(box?: IBoundingBox): GeographicBounds | null {
    if (!box) return null;
    const [west, south] = box.lowerCorner;
    const [east, north] = box.upperCorner;
    const bounds = { west, south, east, north };
    return isValidGeographicBounds(bounds) ? bounds : null;
}

export function isValidGeographicBounds(bounds: GeographicBounds): boolean {
    return Object.values(bounds).every(Number.isFinite)
        && bounds.west >= -180 && bounds.east <= 180
        && bounds.south >= -90 && bounds.north <= 90
        && bounds.west < bounds.east && bounds.south < bounds.north;
}

export function containsBounds(search: GeographicBounds, candidate: GeographicBounds): boolean {
    return candidate.west >= search.west && candidate.east <= search.east
        && candidate.south >= search.south && candidate.north <= search.north;
}
