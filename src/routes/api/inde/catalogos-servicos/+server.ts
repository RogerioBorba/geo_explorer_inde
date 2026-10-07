export async function GET() {
    try {
        const res = await fetch('https://inde.gov.br/api/catalogo/get', { signal: AbortSignal.timeout(20000), redirect: 'error' });
        if (!res.ok) return new Response('Catálogo da INDE indisponível.', { status: res.status });
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error('Catálogo inválido.');
        return Response.json(data);
    } catch { return new Response('Não foi possível carregar o catálogo da INDE.', { status: 502 }); }
}
