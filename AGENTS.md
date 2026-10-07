# AGENTS.md

Orientações para agentes de IA que trabalham neste repositório.

## Visão geral

O Geo_Explorer_INDE é uma aplicação web de consulta, análise e visualização de geosserviços da INDE. A aplicação usa SvelteKit, Svelte, TypeScript, Tailwind CSS, shadcn-svelte, lucide-svelte e OpenLayers, nas versões definidas em `package.json` e resolvidas em `package-lock.json`.

Antes de alterar comportamento relevante, consulte:

- `README.md` para instalação e comandos;
- `src/docs/architecture.md` para responsabilidades das camadas;
- `src/docs/PRD.md` para escopo e requisitos; consulte `src/docs/architecture.md` para as rotas existentes.

## Ambiente e comandos

- Use Node.js 20+ e npm 10+.
- Instale dependências com `npm install`.
- Inicie o ambiente local com `npm run dev`.
- Execute a verificação de Svelte 5 e TypeScript com `npm run check`.
- Execute a validação de padrões de código com `npm run lint` (quando configurado no repositório).
- Gere a versão de produção com `npm run build`.
- Ao criar testes, prefira `node:test` em `tests/`. Quando houver testes para os módulos alterados, execute os arquivos correspondentes em um runtime Node com suporte à execução de TypeScript.

Antes de concluir uma mudança de código, execute pelo menos `npm run check`. Para alterações de integração, rotas ou configuração, execute também `npm run build`.

## Organização do código

- `src/routes/`: páginas, layouts, carregamento de dados e endpoints SvelteKit. Mantenha as rotas focadas em orquestração e composição.
- `src/routes/api/`: endpoints server-side e proxies para serviços externos. Nunca importe código exclusivo do navegador aqui.
- `src/lib/components/`: componentes reutilizáveis. Os componentes de mapa são separados entre `openlayers/` .
- `src/lib/ogc/`: modelos, parsers e tratamento dos protocolos WMS, WFS, WCS e CSW.
- `src/lib/metadata/`: parsing e modelos de metadados ISO 19115.
- `src/lib/inde/`: integrações e adaptações dos catálogos/geosserviços da INDE.
- `src/lib/request/`: comunicação HTTP compartilhada.
- `src/lib/shared/`: estado reativo compartilhado e integrações reutilizadas por várias telas.
- `src/lib/types/`: contratos de domínio compartilhados.
- `tests/`: testes unitários, preferencialmente próximos ao comportamento puro extraído de componentes.

## Convenções de implementação

- Escreva código TypeScript estrito; não introduza `any` sem uma justificativa concreta.
- Use o alias `#lib` para imports internos quando ele tornar a dependência mais clara.
- Em Svelte, prefira os recursos idiomáticos do Svelte 5, incluindo runes (`$state`, `$derived` e `$effect`) quando houver estado reativo.
- Mantenha componentes pequenos e coesos. Extraia parsing, filtragem, transformação e construção de URLs para módulos TypeScript testáveis.
- Não duplique regras no OpenLayers. Coloque comportamento independente do renderizador em módulos compartilhados.
- Preserve a separação entre apresentação, estado, domínio OGC e transporte HTTP.
- Use Tailwind CSS de forma consistente com as telas existentes e transforme padrões visuais repetidos em componentes.
- Mantenha nomes do domínio OGC quando forem termos normativos (`GetCapabilities`, `FeatureType`, `BBOX`, CRS etc.).
- Preserve textos de interface em português, salvo quando o protocolo, a API ou uma biblioteca exigir inglês.
- Escreva documentação, títulos, tabelas e explicações em português do Brasil. Preserve em inglês apenas identificadores técnicos, nomes normativos dos protocolos e termos exigidos pelas APIs ou bibliotecas; não use metadados de ferramentas em inglês como apresentação do PRD.

## Integrações externas e segurança

- Preserve as adaptações do catálogo da INDE para o IBGE e a identificação da instituição, catálogo e serviço de origem. Não substitua os catálogos específicos do IBGE pela entrada geral sem uma mudança de requisito documentada.
- Respeite a versão WMS, os formatos, as projeções, os estilos e as propriedades herdadas das camadas anunciados em `GetCapabilities`, incluindo `queryable`.
- Ofereça `GetFeatureInfo` somente quando a operação for suportada e a camada for consultável; use formatos de resposta anunciados pelo serviço.
- Obtenha a legenda pelo endereço anunciado para o estilo ou por `GetLegendGraphic` quando disponível. A ausência ou falha da legenda não deve impedir a visualização por `GetMap`.

- Considere servidores OGC lentos, instáveis ou incompatíveis. Trate timeout, aborto, respostas não OK e XML incompleto sem travar a interface.
- Requisições sujeitas a CORS devem passar pelas abstrações existentes em `src/lib/request/` e `src/routes/api/`; não espalhe soluções de proxy pelos componentes.
- Alterações no proxy devem validar protocolo e destino e não podem ampliar acesso a localhost, redes privadas ou hosts não confiáveis.
- Não desative validação TLS globalmente. Se uma exceção legada precisar ser modificada, limite-a à requisição estritamente necessária e documente o risco.
- Conforme decisão do responsável, o proxy pode repetir uma conexão HTTPS após falha reconhecida de certificado, somente para um host autorizado pelos catálogos da INDE. A exceção usa configuração local à conexão; preserve bloqueios de DNS privado e redirecionamentos. Ela reduz a garantia de identidade do servidor e nunca deve ser aplicada a falhas genéricas de rede.
- Não registre tokens, credenciais, conteúdo sensível ou respostas externas completas no console.
- Preserve códigos HTTP e `Content-Type` relevantes ao repassar respostas externas.

## Testes e critérios de aceite

- Trabalhe com testes antes da implementação: defina os cenários a partir dos critérios de aceite, escreva e execute os testes relevantes e confirme a falha esperada pela ausência do comportamento antes de implementar. Depois, implemente e execute novamente para confirmar a aprovação; falhas de infraestrutura não contam como falha esperada do comportamento.
- Use Playwright para testes de ponta a ponta dos fluxos de interface quando adequado, incluindo escolha de catálogo, busca, adição de camada e legenda; teste consulta por ponto quando esse incremento for aprovado. Intercepte requisições externas e use fixtures determinísticas. A configuração existe em `playwright.config.ts` e os cenários em `tests/e2e/`.

- Para bugs em lógica pura, adicione primeiro um teste de regressão em `tests/`.
- Cubra casos felizes e falhas comuns: versões OGC diferentes, campos ausentes, coordenadas inválidas, timeout e respostas malformadas.
- Evite testes que dependam de servidores públicos da INDE. Prefira fixtures pequenas e determinísticas.
- Para alterações cartográficas, verifique carregamento, remoção, projeção, BBOX e gerenciamento de camadas no renderizador afetado.
- Não considere a tarefa concluída com erros novos em `npm run check` ou `npm run build`.

## Escopo e manutenção

- Evolua o produto de forma incremental. O escopo atual é exclusivamente o visualizador WMS. WFS será tratado em uma etapa posterior e WCS é uma possibilidade futura; não implemente nem exponha essas funcionalidades na entrega atual. A existência de código desses protocolos não constitui autorização para integrá-los.

- Na próxima entrega, use uma lista única de catálogos da rota `/api/inde/catalogos-servicos/ibge`, preservando o desdobramento do IBGE por departamento e as demais instituições. GetCapabilities é acionado pelo botão “Listar camadas”, não pela seleção isolada.
- O desdobramento por departamento é exclusivo do IBGE; não crie subdivisões adicionais para as demais instituições.
- Mantenha camadas selecionadas em uma única lista reativa compartilhada entre componentes, com tipo explícito WMS nesta etapa; sincronize inclusão e remoção com o mapa. O menu principal oferece somente Home e Visualizador. GetFeatureInfo permanece para um incremento posterior.
- A navegação horizontal fica na Home; o visualizador usa retorno à Home no topo do painel lateral, que pode ser escondido e reaberto sem perder estado. Preserve a árvore WMS com grupos expansíveis; grupos sem Name não são adicionáveis. As seções WMS e Camadas selecionadas também são expansíveis.

- Antes de implementar uma funcionalidade, confira seu escopo e critérios de aceite em `src/docs/PRD.md`. Registre mudanças de escopo no PRD antes da implementação; propostas e questões abertas não equivalem a requisitos aprovados.
- Diferencie arquitetura existente de organização pretendida. Diretórios e capacidades documentados como futuros não devem ser apresentados como implementados.

- Faça mudanças pequenas e focadas; não reformate nem renomeie arquivos sem relação com a tarefa.
- Atualize `src/docs/architecture.md` ou `src/docs/PRD.md` quando uma mudança alterar responsabilidades, fluxos, requisitos ou rotas documentadas.
- Não adicione dependências quando a plataforma ou uma dependência existente já resolver o problema adequadamente.
- Nunca inclua segredos, arquivos de ambiente locais, artefatos de build ou dependências instaladas no controle de versão.

## Entrega

Ao finalizar, informe de forma objetiva:

1. o que foi alterado;
2. quais validações foram executadas;
3. riscos, limitações ou validações manuais ainda necessárias.
