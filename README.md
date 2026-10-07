# Geo_Explorer_INDE

Aplicação web para descobrir e visualizar camadas WMS de geosserviços publicados por instituições participantes da Infraestrutura Nacional de Dados Espaciais (INDE). O projeto está **em desenvolvimento**. A implementação atual usa SvelteKit, Svelte, TypeScript, Tailwind CSS e OpenLayers.

## Aviso de desenvolvimento e isenção de garantias

Este sistema está em desenvolvimento e pode conter erros ou ficar indisponível. É fornecido **no estado em que se encontra**, sem garantias de funcionamento, disponibilidade, precisão ou adequação a qualquer finalidade. O uso é por conta e risco do usuário. Antes de usar mapas ou metadados em análises ou decisões, valide os resultados de forma independente junto às fontes responsáveis.

## O que já funciona

- A Home oferece acesso ao visualizador.
- O visualizador apresenta uma lista única de catálogos obtida pela rota adaptada da INDE. O IBGE é desdobrado por departamento; as demais instituições mantêm os catálogos fornecidos pela fonte.
- Após escolher um catálogo e clicar em **Listar camadas**, o aplicativo lê `GetCapabilities`. A busca filtra as camadas e preserva a hierarquia dos grupos WMS.
- Camadas com `Name` podem ser adicionadas ao mapa. A lista compartilhada **Camadas selecionadas** permite consultar a legenda e remover a camada. Uma falha de `GetMap` retira a camada do mapa e da lista, permitindo nova tentativa.
- Quando a camada anuncia `MetadataURL`, a ação **Metadados** abre `/metadado` para apresentar registros ISO interpretáveis. Se a leitura falhar, a página oferece o endereço original.
- A requisição inicial de `GetMap` usa o estilo padrão do servidor (`STYLES=`). A legenda padrão é solicitada por `GetLegendGraphic` quando o serviço anuncia essa operação em formato compatível.

O escopo integrado nesta etapa é **WMS**. Consulta por clique com `GetFeatureInfo`, WFS, WCS e descoberta CSW pertencem a etapas futuras. A presença de arquivos legados desses protocolos não significa que estejam disponíveis no visualizador atual.

## Executar localmente

Requisitos: Node.js 20 ou superior e npm 10 ou superior.

```sh
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite. Na Home, entre em **Visualizador**, escolha um catálogo, clique em **Listar camadas**, busque uma camada e use a ação ao lado do nome para adicioná-la ao mapa. O painel lateral pode ser recolhido e reaberto. A ação de metadados só aparece quando o serviço anuncia um endereço utilizável.

## Verificações

```sh
npm test
npm run test:e2e:install
npm run test:e2e
npm run check
npm run build
npm run preview
```

`npm test` executa os testes unitários. A instalação do navegador Chromium para Playwright (`test:e2e:install`) é necessária antes da primeira execução dos testes de interface. `npm run check` verifica Svelte e TypeScript; há diagnósticos conhecidos em módulos legados, descritos na [arquitetura](src/docs/architecture.md). `npm run build` gera a aplicação, e `npm run preview` permite conferir localmente essa versão. Não há script `lint` configurado no `package.json`.

Os testes de interface usam respostas simuladas dos serviços externos. Resultados aprovados nesses testes não comprovam a disponibilidade dos catálogos públicos. A implantação exige configurar o adaptador de produção adequado ao ambiente de hospedagem; o projeto usa `adapter-auto` atualmente.

## Dados externos e limitações

Os catálogos, mapas e metadados vêm de instituições externas. Endereços podem estar indisponíveis, lentos, incompletos ou responder em formatos incompatíveis. A aplicação tenta o proxy do servidor quando uma requisição direta do navegador falha por rede ou CORS. O proxy restringe os destinos aos catálogos autorizados e aplica limites de tempo e tamanho; há uma exceção localizada para falhas reconhecidas de certificado em destinos autorizados, explicada em [segurança do proxy](src/docs/seguranca-proxy.md). A leitura amigável de metadados cobre registros ISO interpretáveis; registros publicados apenas como HTML podem exigir abertura pelo endereço original.

## Documentação do projeto

- [PRD](src/docs/PRD.md): escopo, requisitos e critérios de aceite.
- [Arquitetura](src/docs/architecture.md): rotas, componentes, integrações e limitações conhecidas.
- [Plano de implementação WMS](src/docs/implementacao-wms.md): incrementos e registros de validação.
- [Segurança do proxy](src/docs/seguranca-proxy.md): limites atuais e pontos para avaliação antes de publicar.
- [Reflexões sobre dados volumosos](src/docs/reflexoes-dados-volumosos.md): questões futuras para WFS e WCS.
- [AGENTS.md](AGENTS.md): orientações de trabalho neste repositório.
