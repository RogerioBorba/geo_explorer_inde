# Plano de implementação — Home e visualizador WMS

## Objetivo e autoridade

Implementar o fluxo revisado em `src/docs/PRD.md`: Home, menu Home/Visualizador, lista única de catálogos, botão de listagem, linhas compactas, metadados e inclusão no mapa com estado compartilhado de selecionadas, legenda e remoção.

Este plano substitui o plano anterior de descoberta com duas seleções e sem inclusão no mapa. A implementação foi autorizada pelo responsável após a revisão das referências e segue os incrementos abaixo.

## Escopo e limites

Cobrir R1–R7, R10–R11 e R15–R18. R8–R9 e R12–R14 ficam para incrementos posteriores. Não incluir GetFeatureInfo, WFS, WCS, CSW, pesquisa global, filtros espaciais, relatórios ou menus separados por protocolo.

A fonte é exclusivamente `/api/inde/catalogos-servicos/ibge`, já adaptada para desdobrar IBGE por departamento e manter as demais instituições. Não substituir pelo catálogo geral da INDE.

Apenas o IBGE recebe esse desdobramento; as demais instituições e seus catálogos permanecem conforme fornecidos pela INDE.

## Decisões técnicas

- Manter OpenLayers e dependências existentes; Playwright já está instalado.
- Usar `layerManager.selectedLayers`, em `src/lib/shared/openlayers/shared.svelte.ts`, como ponto de partida para a única lista compartilhada. Corrigir seu contrato e reduzir acoplamento em tempo de execução com a fachada legada, sem criar lista paralela na página.
- Usar entradas discriminadas por tipo, WMS nesta etapa, identificadas por serviço e nome da camada. Guardar origem, versão, estilo, metadados e legenda; manter objetos de renderização fora do domínio. Avaliar `$state.raw` para instâncias não reativas do mapa.
- Reconciliar `descoberta.ts` e `wmsCapabilities.ts` num caminho de parsing coerente; componentes consomem o mesmo modelo. Preservar propriedades herdadas conforme WMS, referências de operações e URLs anunciadas. Não presumir que a URL de GetCapabilities seja o endpoint de GetMap.
- Preferir `ImageWMS` e `ImageLayer` para a inclusão inicial, como no código existente. Selecionar formato e projeção compatíveis com as capacidades; apresentar mensagem clara se a camada não puder ser exibida no mapa atual.
- Abrir `/metadado` em nova aba com o endereço HTTP/HTTPS anunciado em MetadataURL codificado na URL. Resolver endereços relativos pelo documento WMS. `MetadataViewer.svelte` apresenta registros ISO interpretáveis; diante de conteúdo incompatível ou indisponível, mostra a falha e oferece o endereço original. Não incorporar HTML externo na aplicação.
- Usar a legenda anunciada pelo estilo; recorrer a GetLegendGraphic somente quando suportado. A ausência ou falha de legenda não remove a camada do mapa.
- Inclusão repetida da mesma combinação serviço/camada não cria duplicatas; a interface indica que a camada já foi adicionada. Diferentes serviços podem ter nomes de camada iguais.

## Incrementos, testes e implementação

| Incremento | Teste antes da implementação | Alterações previstas | Aceite |
| --- | --- | --- | --- |
| 1. Home e navegação | Abrir `/`, encontrar nome e somente Home/Visualizador, navegar entre as páginas. | Componente de navegação e página inicial; evitar duplicar cabeçalho no visualizador. | AE10. |
| 2. Catálogo e lista compacta | Confirmar que há uma seleção única; seleção não requisita capabilities; clicar em listar carrega; busca, vazio, erro e resposta antiga são tratados. | Atualizar página e componentes de descoberta, preservar API adaptada; substituir cartões por linhas. | AE1–AE2, R18. |
| 3. Modelo WMS e metadados | Fixtures WMS 1.1.1/1.3.0 com grupos, camadas, namespaces, estilos herdados, URLs relativas, metadados ausentes e XML inválido. Ação abre somente URL utilizável. | Consolidar parsing e contratos OGC; mapear metadados para as linhas. | AE9, R10, R15. |
| 4. Lista compartilhada e mapa | Adicionar gera GetMap e imagem visível, item aparece em selecionadas; segunda inclusão não duplica; nomes iguais em serviços distintos coexistem; troca de catálogo preserva selecionadas. | Ajustar estado compartilhado, manager e adaptação OpenLayers; integrar mapa e painel. | AE3, AE8. |
| 5. Legenda e remoção | Abrir legenda do estilo; ausência ou erro mantém mapa; remover retira item e objeto cartográfico; remontar não duplica listeners nem camadas. | Ações em selecionadas e exibição de legenda, limpeza de recursos. | AE3–AE4, R16, R18. |
| 6. Integração e revisão | Transporte com destino codificado, aborto, timeout e falhas; testes em desktop/celular, teclado e ausência de erros novos. | Corrigir apenas lacunas de integração necessárias, atualizar documentação e registrar evidências. | R4 e regras de qualidade. |

Em cada incremento, executar um cenário comportamental e confirmar a falha pela funcionalidade ausente; implementar somente o suficiente para passá-lo e seguir ao próximo. Testes que já cobrem comportamento existente são preservados como regressão. Não tratar falha de infraestrutura como evidência válida de TDD.

## Testes e evidências

Playwright exercita a interface real; intercepta apenas fronteiras HTTP externas e fornece XML, imagens GetMap e legendas determinísticas. Verificar o resultado visível e os parâmetros essenciais de requisição, sem simular componentes, estado compartilhado ou OpenLayers. Testes unitários via `node:test` cobrem normalização, filtragem e construção de parâmetros; parsing DOM pode ser exercitado no navegador para não acrescentar uma biblioteca apenas para testes.

Manter cenários de erro da API de catálogos, capabilities inválido, catálogo vazio, resposta atrasada, GetMap indisponível, metadados ausentes e legenda indisponível. Os cenários de mapas devem demonstrar carregamento e remoção, projeção e BBOX compatíveis.

Executar `npm run test:e2e`, `npm run check` e `npm run build`, além dos testes unitários existentes ou adicionados. Se npm não estiver no PATH do ambiente do agente, usar o runtime disponível para executar os mesmos scripts e registrar essa equivalência. Capturar desktop e celular para inspeção visual.

## Riscos e critérios de conclusão

A base possui erros legados; não declarar verificação de tipos aprovada enquanto houver erros. Comparar diagnósticos com a base, corrigir todos os novos e relatar os preexistentes. Não ampliar a tarefa para todos os protocolos nem ocultar problemas com exclusões globais.

O proxy usa o catálogo como referência de hosts autorizados, bloqueia protocolos indevidos, credenciais na URL, portas alternativas, redes privadas e redirecionamentos. Resolve DNS e fixa um endereço público na conexão, com limite de tempo e resposta de até 32 MiB. A desativação global de TLS foi removida. Conforme orientação do responsável, após falha reconhecida de certificado pode haver uma nova tentativa HTTPS sem validação de certificado, exclusivamente nessa conexão com host catalogado. Essa exceção reduz a garantia de identidade do servidor; falhas genéricas de rede não a acionam. Antes de publicação, avaliar limites de requisições no ambiente de hospedagem.

Concluir o incremento somente com o fluxo catálogo → listar → adicionar → mapa e selecionadas → legenda/metadados/remover funcionando, navegação correta e testes correspondentes aprovados. Relatar limitações reais de servidores externos e problemas legados restantes. Não há Git inicializado nesta pasta; esta entrega permanece local, sem commits ou publicação.

## Registro da entrega

### Leitura de metadados WMS — 7 de outubro de 2026

As ações de metadados da descoberta e das selecionadas encaminham à rota `/metadado`, que passa o endereço à `MetadataViewer.svelte`. A página apresenta campos de registros ISO MD_Metadata e preserva o link original quando não consegue interpretar a resposta. A ação não aparece sem MetadataURL. Os testes de interface foram escritos e executados antes do ajuste, confirmando a navegação externa anterior, e depois validaram o novo percurso e a falha recuperável.

### Estilo padrão WMS — 7 de outubro de 2026

O primeiro Style anunciado em GetCapabilities não define o estilo padrão do servidor. A inclusão inicial passa a solicitar `STYLES=`; GetLegendGraphic, quando anunciado, é chamado sem `STYLE` para a mesma seleção padrão. LegendURL de estilo nomeado fica reservada para quando houver escolha explícita desse estilo. Esta decisão substitui a seleção automática do primeiro estilo descrita no registro histórico abaixo.

### Remoção após falha de GetMap — 7 de outubro de 2026

Uma falha confirmada de GetMap remove a camada da lista compartilhada e do mapa, permitindo adicioná-la novamente. Cancelamentos não removem a seleção; falhas de legenda também preservam a camada. O aviso permanece por dois segundos, independentemente da remoção automática, e os temporizadores são limpos no sucesso ou na desmontagem. O teste de regressão falhou antes da correção e passou depois, incluindo nova inclusão bem-sucedida. Passaram os 20 cenários Playwright, os oito testes unitários e a compilação de produção. A verificação de tipos mantém os 96 erros e 15 avisos legados, sem novos diagnósticos nos arquivos alterados.

### Correção de estilos e avisos de GetMap — 7 de outubro de 2026

O GetMap de Grande Região e Grade estatística - 500km - 2019 do CGMAT foi comparado com estilos herdados dos agrupadores e estilos próprios. As chamadas com estilo de agrupador retornaram XML de erro com HTTP 200; com o estilo próprio retornaram PNG. O parser agora prioriza os estilos diretamente declarados na camada, mantendo os herdados disponíveis. A legenda acompanha o mesmo estilo usado na inclusão. Os avisos de falha desaparecem após dois segundos e seus temporizadores são limpos na remoção e desmontagem. Testes de regressão confirmaram primeiro as falhas de prioridade e de persistência, depois a correção. A suíte resultante passou com 20 cenários Playwright e oito testes unitários, incluindo compilação de produção.

### Incremento de painel e árvore — 7 de outubro de 2026

Autorizado pelo responsável: remover o cabeçalho horizontal do visualizador, acrescentar Home e recolhimento ao topo do painel, manter controle de reabertura sobre o mapa e usar Accordion nas seções WMS e Camadas selecionadas. Conforme refinamento posterior, agrupamentos internos usam uma árvore compacta de listas aninhadas, com pastas e controles de expansão, sem Accordion por grupo. Preservar ancestrais na busca, ações em nós nomeados e estado ao recolher. Foram criados cenários de interface antes da implementação de navegação e hierarquia; fixtures simples e agrupadas têm cobertura separada. Bits UI foi acrescentado por ser a base do Accordion solicitado.

Validação do incremento: 19 cenários Playwright e oito testes unitários aprovados. Playwright compila e testa por `vite preview`, evitando recargas automáticas que interferiam na seleção durante testes no servidor de desenvolvimento. Foram verificadas capturas em desktop e celular. A geração de produção passou; a verificação de tipos mantém 96 erros e 15 avisos legados, sem novos diagnósticos. Um import da página de metadados foi atualizado de `$lib` para `#lib` para compatibilidade com o SvelteKit usado no projeto.

Os seis incrementos foram implementados no fluxo WMS. A suíte reúne oito testes unitários e 16 cenários Playwright, incluindo versões WMS, herança, nomes iguais em serviços distintos, falhas, cancelamento, legenda, remoção e remontagem do mapa. A verificação de tipos ainda encontra 96 erros e 15 avisos legados; não há erros novos nos módulos desta entrega. A geração de produção compilou. Os comandos foram executados pelo runtime Node disponível, usando os executáveis locais correspondentes aos scripts npm.

A avaliação de limites de requisições foi solicitada durante a implementação e registrada em `src/docs/seguranca-proxy.md`. Os limites de frequência e concorrência ali propostos ainda não foram implementados. A reflexão futura de WFS/WCS está em `src/docs/reflexoes-dados-volumosos.md`. A disponibilidade e os certificados dos serviços públicos reais ainda exigem validação operacional.
