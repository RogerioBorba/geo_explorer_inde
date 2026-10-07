# Reflexões sobre dados volumosos — WFS e WCS

Documento para discussão futura, criado em 6 de outubro de 2026 a pedido do responsável. Não amplia o escopo aprovado: a entrega atual permanece exclusivamente WMS. WFS será uma etapa posterior e WCS continua como possibilidade.

## O que muda em relação ao WMS

No fluxo atual, WMS fornece imagens da área visualizada. WFS poderá trazer feições e atributos, exigindo interpretação e renderização de dados vetoriais no cliente. WCS poderá trazer coberturas que exigem decisões de recorte, resolução, formato e decodificação. Não assumir que o mesmo limite de bytes ou a mesma estratégia de carregamento atende aos três protocolos.

Mesmo sem passar pelo proxy, uma resposta grande pode esgotar memória ou bloquear a interface. Tamanho transferido, tamanho descomprimido, custo de parsing e memória dos objetos cartográficos são medidas diferentes. Uma transferência pequena não garante processamento leve.

## Frentes de investigação

| Frente | Perguntas e alternativas a avaliar |
| --- | --- |
| Descoberta | Que volume, extensão, formato e limitações o serviço anuncia? O que precisa ser consultado antes de transferir dados? |
| WFS | É possível restringir área, atributos e quantidade de feições? Qual paginação a versão e o servidor realmente oferecem? |
| WCS | É possível recortar a área e reduzir a resolução? Como estimar o tamanho da cobertura e quais formatos o navegador consegue interpretar? |
| Navegador | Quanto consomem parsing, objetos e renderização em desktop e celular? O processamento deve sair da linha principal para um worker? |
| Transporte | Quando usar acesso direto ou proxy? Como limitar bytes durante a transferência, cancelar e descartar resultados substituídos? |
| Interface | Como mostrar progresso e permitir cancelamento? Quando explicar que a seleção excede o limite e orientar uma área menor? |
| Infraestrutura | Qual memória e concorrência estarão disponíveis? Uma ou várias instâncias? Como aplicar cache e limites compartilhados? |

## Princípios para discutir

- Preferir obter os dados necessários à área e finalidade atuais, evitando baixar o conjunto completo para iniciar uma visualização.
- Definir limites separados para transferência, número de elementos e processamento. O limite atual de 32 MiB do proxy WMS não é uma decisão para WFS/WCS.
- Detectar excesso durante a leitura, mesmo quando `Content-Length` estiver ausente ou incorreto. Cancelar o transporte e liberar memória quando o resultado não for mais necessário.
- Manter a interface utilizável e apresentar erros localizados; uma camada grande não deve inutilizar as demais.
- Diferenciar visualização de eventual download de dados completos. Um fluxo de download, se aprovado no futuro, pode ter restrições próprias.
- Considerar formatos e capacidades reais de cada serviço; não prometer paginação ou redução de resolução universal.

## Como transformar a reflexão em decisões

Preparar fixtures representativas de vetores simples, geometrias complexas, muitos atributos e rasters com diferentes resoluções. Medir tempo de transferência, parsing, renderização, pico de memória, fluidez da interface e cancelamento nos dispositivos atendidos. Usar serviços simulados para testes de carga, sem sobrecarregar os servidores públicos.

A partir das medições, registrar orçamentos de bytes, feições, resolução e concorrência e os critérios de aceite no PRD do incremento correspondente. Só então escolher a estratégia de paginação, recorte, processamento e armazenamento transitório. Os números ainda estão em aberto; a hospedagem não foi definida.

Documento relacionado: [Avaliação de sobrecarga do proxy](seguranca-proxy.md). Esse documento trata o servidor intermediário; esta reflexão inclui também o custo no cliente.
