import type { RequestHandler } from './$types';
import { validarDestino, requisitarCatalogado } from '#lib/request/proxySeguro.ts';

export const GET: RequestHandler = async ({ url, request, fetch }) => {
  const target = url.searchParams.get('url');
  if (!target) return new Response('Informe o destino.', { status: 400 });
  let parsed: URL;
  try { parsed = new URL(target); } catch { return new Response('URL inválida.', { status: 400 }); }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(65000)]);
  try {
    const catalog = await fetch('/api/inde/catalogos-servicos/ibge', { signal });
    if (!catalog.ok) return new Response('Catálogo indisponível para validar o destino.', { status: 502 });
    const data: unknown = await catalog.json();
    const hosts = new Set<string>();
    if (Array.isArray(data)) for (const entry of data) {
      if (!entry || typeof entry !== 'object') continue;
      for (const key of ['url', 'wmsGetCapabilities']) {
        const value = (entry as Record<string, unknown>)[key];
        if (typeof value === 'string') try { hosts.add(new URL(value).hostname); } catch { /* Registro inválido não autoriza destino. */ }
      }
    }
    try { parsed = validarDestino(target, hosts); } catch { return new Response('Destino não permitido.', { status: 403 }); }
    return await requisitarCatalogado(parsed, signal, request.headers.get('accept') ?? '*/*');
  } catch {
    return new Response(signal.aborted ? 'O serviço excedeu o tempo limite ou foi cancelado.' : 'Não foi possível consultar o serviço.', { status: signal.aborted ? 504 : 502 });
  }
};
