# Demonstração da POC

Atualizado em 24/10/2026. A demonstração de produto usa o bot do Telegram e a consulta da equipe, com dados fictícios. A consulta não tem botões de simulação.

## Roteiro

1. Iniciar uma tentativa no Telegram com /nova e informar a data fictícia da prova.
2. Confirmar a data marcada ou identificá-la como pretendida. Remarcar por /data quando necessário.
3. Após o vencimento combinado, responder se realizou a prova e informar o resultado.
4. Avaliar o curso e os simulados separadamente; conteúdo, formato e dificuldade não são uma única nota.
5. Deixar comentário opcional e conferir a confirmação de registro.
6. Na consulta da equipe, carregar as respostas com a credencial de leitura. Cada ficha exibe uma tentativa: prova/resultado, curso, simulados e comentário, sem rolagem horizontal.

O teste real do ciclo principal já foi executado. Para simular a passagem dos dias nesse teste, apenas o vencimento de uma tentativa fictícia foi antecipado por operação técnica controlada; o cron publicado fez o disparo. Isso não altera o relógio global e não deve ser confundido com esperar dias reais. Evidência: [implementação e testes](../levantamentos/2026-10-24-implementacao-poc.md).

## Consulta da equipe

As fichas são ordenadas das mais recentes às anteriores. A origem distingue conversa pelo Telegram de exemplos anteriores. Tentativas sem realização, ausência e cancelamento não aparecem como avaliações negativas. Não uso, não resposta e incapacidade de avaliar permanecem separados.

O resumo mostra realização, resultados conhecidos e pendentes com denominadores. Indicadores adicionais do curso e dos simulados ficam em uma seção recolhível. Não há oferta comercial no bot.

## Testes técnicos

Os cenários enumerados A/B/C e suas ações continuam disponíveis na API restrita para testes automatizados, sem interface na consulta da equipe. Eles não são uma etapa de trabalho da operação.
