<script lang="ts">
  import { page } from '$app/state';
</script>
<header class="flex min-h-16 flex-wrap items-center gap-x-8 gap-y-2 border-b border-slate-200 bg-slate-50 px-6 py-3 text-slate-900">
  <span class="text-lg font-bold text-teal-900">Geo_Explorer_INDE</span>
  <nav aria-label="Menu principal" class="flex items-center gap-6 text-sm">
    <a href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined} class="rounded px-2 py-1 hover:bg-slate-200 aria-[current=page]:font-semibold">Home</a>
    <a href="/visualizador/ol" aria-current={page.url.pathname.startsWith('/visualizador') ? 'page' : undefined} class="rounded px-2 py-1 hover:bg-slate-200 aria-[current=page]:font-semibold">Visualizador</a>
  </nav>
</header>
