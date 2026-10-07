import { obterResposta, type GetOptions } from './transporte.ts';

export async function get(url: string | URL, options: GetOptions = {}): Promise<Response> {
  const response = await obterResposta(url, { ...options, proxyOrigin: typeof window === 'undefined' ? undefined : window.location.origin });
  if (!response.ok) throw new Error(`O serviço respondeu com erro HTTP ${response.status}.`);
  return response;
}
