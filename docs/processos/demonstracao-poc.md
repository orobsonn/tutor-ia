# Demonstração da POC

Roteiro de demonstração de 3–5 minutos. Fluxos exercitados nos testes; apresentação humana completa ainda não homologada. Usar [cenários fictícios](../referencias/exemplos/cenarios.json) e relógio simulado explícito.

| Cena | O que mostrar | Critério |
|---|---|---|
| Data | Estudante A registra produto/prova e remarca | Contato antigo fica inválido |
| Pós-prova | Avançar data e confirmar realização/aprovação | Resultado identificado como declarado |
| Curso e simulados | Avaliação positiva do curso e crítica aos simulados | Dimensões e recursos separados |
| Visão da equipe | Resultado e relato lado a lado | Aprovação não esconde oportunidade de melhoria |
| Exceção curta | Estudante B aguarda resultado e não usou simulados | Pode avaliar curso; não gera nota negativa de simulado |

Verificações adicionais: pausa impede novo contato programado; silêncio não vira reprovação; ausência não produz avaliação de aderência; correção não duplica tentativa.

O participante usará Telegram. Enquanto o bot exclusivo não existe, a tela da equipe oferece um simulador autenticado com os mesmos estados persistidos. Mostrar somente participantes e dados de demonstração; não precisa integrar plataforma acadêmica, executar campanha ou operar com alunos reais.

## Controles disponíveis no simulador

- Avançar A/B/C executa um passo fechado por clique. No passo de aguardo, avança somente o relógio desse participante fictício.
- A: depois dos três primeiros avanços, usar Remarcar A e avançar novamente a data/confirmação antes de seguir a pesquisa.
- B: completar a pesquisa pendente; Corrigir resultado B abre a pergunta e o segundo clique confirma aprovação sem apagar feedback.
- C: após três avanços, Pausar C e Avançar C mantêm o aguardo. Retomar C e avançar levam à pergunta de realização; o próximo avanço registra ausência sem pesquisa. Nova tentativa C cria uma tentativa separada; Cancelar C então registra cancelamento sem apagar a ausência anterior.
- No chat, confirmar uma data como pretendida a mantém separada de uma prova marcada e não programa contato pós-prova.
- A consulta mostra contagens com denominadores; não uso e pendência são apresentados separadamente.
