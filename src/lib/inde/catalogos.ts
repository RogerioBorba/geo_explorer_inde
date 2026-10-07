export interface CatalogoWMS {
  id: string;
  instituicao: string;
  titulo: string;
  capabilitiesUrl: string;
}

export function catalogosWMS(data: unknown): CatalogoWMS[] {
  if (!Array.isArray(data)) throw new Error('A lista de catálogos recebida é inválida.');
  return data.flatMap((item: unknown, index) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    if (entry.wmsAvailable === false || typeof entry.wmsGetCapabilities !== 'string' || typeof entry.descricao !== 'string' || !entry.descricao.trim()) return [];
    let url: URL;
    try { url = new URL(entry.wmsGetCapabilities); } catch { return []; }
    if (!['http:', 'https:'].includes(url.protocol)) return [];
    const titulo = entry.descricao.trim();
    const instituicao = typeof entry.sigla === 'string' && entry.sigla.trim() ? entry.sigla.trim() : titulo.split(' - ')[0];
    return [{ id: String(index), instituicao, titulo, capabilitiesUrl: url.href }];
  });
}
