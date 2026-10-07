# Avaliação de sobrecarga do proxy

Avaliação do código em 6 de outubro de 2026. Não é um teste de carga em produção; o responsável confirmou que o ambiente de hospedagem ainda não foi definido. A quantidade de usuários também não foi dimensionada.

## Situação observada

O navegador tenta o serviço diretamente; em falhas de rede, recorre a `/api/get`. A imagem WMS usa `ImageWMS`: não abre uma requisição por mosaico, mas deslocamento, zoom e camadas simultâneas podem gerar várias imagens. Pedidos substituídos são cancelados. O corpo completo fica em memória no transporte para que o prazo também cubra sua leitura.

O proxy valida o destino consultando o catálogo adaptado em cada chamada. Hoje não há cache, fila, limitação por cliente nem teto global de conexões. Uma conexão tem prazo de 65 segundos, recebe no máximo 32 MiB e não segue redirecionamentos. A tentativa excepcional por certificado pode abrir uma segunda conexão sequencial, dentro do mesmo prazo, somente para uma instituição catalogada.

Vinte respostas simultâneas no limite representam **640 MiB de conteúdo**, antes das cópias de buffers e demais custos do servidor. Esse número é uma estimativa baseada no limite do código, não uma medição de memória. O prazo e o tamanho individual não evitam a sobrecarga acumulada.

## Política inicial proposta

Os valores abaixo são uma hipótese para validação, não limites já implementados nem requisitos aprovados.

| Controle | Ponto de partida | Finalidade |
| --- | --- | --- |
| Frequência por cliente | 60 pedidos por minuto, com pico de 10 | Conter repetição abusiva sem impedir navegação normal. |
| Concorrência por cliente | 4 chamadas ativas | Evitar que um único cliente ocupe todo o proxy. |
| Concorrência global por instância | 8 chamadas ativas | Conter memória e conexões; confirmar com a memória disponível na hospedagem. |
| Concorrência por instituição | 4 chamadas ativas | Reduzir pressão sobre um mesmo servidor OGC. |
| Cache de catálogo | 5 minutos e uma única atualização em curso | Evitar consultar a INDE a cada imagem; cache não substitui validação DNS de cada conexão. |
| Recusa por limite | HTTP 429 com `Retry-After` | Permitir mensagem clara e nova tentativa sem fila ilimitada. |

O teto global deve considerar tamanho máximo de resposta, cópias de memória e orçamento da instância. Os valores sugeridos não garantem capacidade: com oito respostas de 32 MiB ainda existem 256 MiB de conteúdo antes das cópias. Para instâncias menores, reduzir concorrência ou tamanho, ou estudar transporte em fluxo com prazo durante todo o corpo.

Não confiar diretamente em `X-Forwarded-For` informado pelo usuário. A identidade do cliente deve vir do adaptador e do proxy de entrada configurados na hospedagem. Pessoas numa mesma rede podem compartilhar IP; tratar esse limite como proteção operacional, não como identidade de usuário.

Em uma instância Node.js, contadores locais podem servir ao primeiro incremento. Em múltiplas instâncias ou funções, usar o controle compartilhado da plataforma ou um armazenamento adequado; limites locais se multiplicariam pelo número de instâncias. Cache em memória é transitório e não exige banco de domínio do produto.

## Validação antes da publicação

1. Executar carga contra um serviço simulado, sem atingir instituições públicas, com latência, corpo lento, falha TLS e respostas próximas do limite.
2. Comparar navegação normal com 1, 4 e 8 camadas e com vários clientes. Medir pedidos por minuto, conexões ativas, memória e latência; verificar que zoom e deslocamento continuam utilizáveis.
3. Confirmar recusa imediata com 429, `Retry-After`, liberação de vagas após aborto, timeout ou falha e ausência de fila ilimitada.
4. Confirmar uma atualização de catálogo para chamadas concorrentes, expiração do cache e ausência de autorização nova quando o catálogo não puder ser validado.
5. Registrar apenas métricas agregadas de volume, status, duração e concorrência, sem URLs completas, credenciais ou respostas externas.

Conclusão: priorizar cache do catálogo e limites de concorrência junto ao limite de frequência. O incremento de proteção contra sobrecarga deve ser definido conforme a hospedagem e validado com carga simulada antes de publicação pública.

## WFS e WCS nas etapas futuras

A reflexão detalhada está em [Reflexões sobre dados volumosos](reflexoes-dados-volumosos.md), separada do plano WMS.

O responsável destacou o risco de respostas vetoriais e raster grandes. Além do servidor, considerar memória, decodificação e processamento no navegador. Limites de frequência do proxy não resolvem esses custos do cliente.

Para WFS, estudar recorte espacial, seleção de atributos, limite de feições e paginação quando suportada, além de cancelamento e limite de bytes. Para WCS, estudar recorte espacial, resolução e tamanho estimado da cobertura antes da transferência. Evitar baixar conjuntos completos apenas para exibir uma pequena área.

Definir orçamentos de tamanho e memória a partir de fixtures representativas e medições nos dispositivos atendidos. Os 32 MiB do proxy WMS não constituem um limite aprovado para WFS/WCS. Essas decisões serão especificadas nos incrementos correspondentes; nenhum desses protocolos entra na implementação atual.
