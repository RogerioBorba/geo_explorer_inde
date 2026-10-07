export type GetOptions = RequestInit & { timeout?: number; proxyOrigin?: string };

/** Mantém o prazo até o corpo completo; aborto do chamador nunca gera nova tentativa. */
export async function obterResposta(url: string | URL, options: GetOptions = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  const { timeout = 65000, proxyOrigin, signal, ...init } = options;
  const target = new URL(url);
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new Error('O serviço excedeu o tempo limite.')), timeout);
  try {
    combined.throwIfAborted();
    let response: Response;
    try { response = await fetcher(target, { ...init, signal: combined }); }
    catch (error) {
      combined.throwIfAborted();
      if (!proxyOrigin || !(error instanceof TypeError)) throw error;
      const proxy = new URL('/api/get', proxyOrigin);
      proxy.searchParams.set('url', target.href);
      response = await fetcher(proxy, { ...init, signal: combined });
    }
    const body = response.body ? await response.arrayBuffer() : null;
    combined.throwIfAborted();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { clearTimeout(timer); }
}
