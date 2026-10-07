import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestOptions } from 'node:https';

export function enderecoPublico(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)));
  }
  // Somente endereços IPv6 unicast globais; exclui mapeamentos IPv4 e redes locais.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}

export function validarDestino(value: string, hosts: ReadonlySet<string>): URL {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !hosts.has(url.hostname) || isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('Destino não permitido.');
  return url;
}

/** Resolve uma vez e fixa o endereço público na conexão, sem seguir redirecionamentos. */
export function certificadoInvalido(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(String(error.code));
}

export async function requisitarCatalogado(url: URL, signal: AbortSignal, accept = '*/*'): Promise<Response> {
  try { return await requisitarPublico(url, signal, accept); }
  catch (error) {
    if (url.protocol !== 'https:' || !certificadoInvalido(error) || signal.aborted) throw error;
    // Exceção aprovada pelo responsável: uma conexão, após validação do catálogo e DNS.
    return requisitarPublico(url, signal, accept, false);
  }
}

export async function requisitarPublico(url: URL, signal: AbortSignal, accept = '*/*', rejectUnauthorized = true): Promise<Response> {
  signal.throwIfAborted();
  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void lookup(url.hostname, { all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(item => !enderecoPublico(item.address))) throw new Error('Destino não permitido.');
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      signal, rejectUnauthorized, autoSelectFamily: false, headers: { Accept: accept },
      lookup: (_hostname, _options, callback) => callback(null, chosen.address, chosen.family)
    };
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, res => {
      const status = res.statusCode ?? 502;
      if (status >= 300 && status < 400) { res.destroy(); reject(new Error('Redirecionamento não permitido.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) { res.destroy(new Error('Resposta excede o limite permitido.')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        const headers = new Headers({ 'Content-Type': res.headers['content-type'] ?? 'application/octet-stream' });
        resolve(new Response([204, 205, 304].includes(status) ? null : new Uint8Array(Buffer.concat(chunks)), { status, headers }));
      });
    });
    req.on('error', reject); req.end();
  });
}
