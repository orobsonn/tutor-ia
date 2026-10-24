# Demonstração da POC

Atualizado em 24/10/2026. A demonstração de produto usa o bot do Telegram e a consulta da equipe, com dados fictícios. A consulta não tem botões de simulação.

## Roteiro

1. Abrir o bot autorizado e enviar **/teste**. Funciona também no primeiro contato.
2. Informar uma data fictícia de hoje em diante no formato DD/MM/AAAA e confirmar que está marcada.
3. O bot simula imediatamente a passagem da prova e pergunta se ela foi realizada, sem esperar D+1.
4. Informar resultado e avaliar o curso e os simulados separadamente: conteúdo, formato e dificuldade.
5. Deixar comentário opcional e consultar /resumo. Para repetir, enviar /teste.
6. Na consulta da equipe, carregar as respostas com a credencial de leitura. A ficha aparece como **Modo de teste**, fora dos indicadores normais.

O teste é uma tentativa separada, preserva o histórico e não agenda contato futuro. Não altera o relógio nem datas no banco. Se houver prova normal confirmada em acompanhamento, /teste explica o conflito e preserva essa agenda; conclua a tentativa antes de testar. Uma data apenas pretendida não inicia o pós-prova, inclusive no teste.

O fluxo normal continua disponível por /nova (ou /start no primeiro contato), com contato no D+1. O teste imediato valida o questionário e a gravação; a execução real do agendador é validada separadamente.

## Consulta da equipe

As fichas são ordenadas das mais recentes às anteriores. A origem distingue conversa pelo Telegram de exemplos anteriores. Tentativas sem realização, ausência e cancelamento não aparecem como avaliações negativas. Não uso, não resposta e incapacidade de avaliar permanecem separados.

O resumo mostra realização, resultados conhecidos e pendentes com denominadores. Indicadores adicionais do curso e dos simulados ficam em uma seção recolhível. Não há oferta comercial no bot.

## Testes técnicos

Os cenários enumerados A/B/C e suas ações continuam disponíveis na API restrita para testes automatizados, sem interface na consulta da equipe. Eles não são uma etapa de trabalho da operação.
