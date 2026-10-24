# Escopo vigente da POC

Data: 24/10/2026. Status: recorte adotado para construção de uma demonstração com dados fictícios.

## Objetivo

Demonstrar o ciclo **data da prova → contato pós-prova → realização/resultado → feedback sobre curso e simulados → informação organizada para a equipe**.

O problema inicial é conhecer o desfecho da certificação e obter sinais sobre a adequação da preparação. Não é montar uma rotina de estudo nesta primeira entrega.

## Incluído

- Identificar aluno fictício, curso/produto e certificação.
- Registrar data marcada, intenção ainda sem confirmação ou ausência de data.
- Corrigir, remarcar e cancelar o agendamento.
- Fazer contato após a data, começando pela confirmação de realização.
- Registrar aprovação, reprovação ou resultado pendente, como informação declarada pelo aluno.
- Coletar separadamente percepção de aderência do curso e dos simulados.
- Mostrar registros e um resumo simples à equipe, com quantidade de respostas.
- Permitir pausa e manter ausência de resposta como desconhecida.

## Excluído

Planejamento de estudo, acompanhamento de progresso, recuperação por inatividade, personalização por questões, tira-dúvidas, ingestão de conteúdo, integração com banco de aulas, dados reais, campanhas e ofertas comerciais.

## Dependências e limites

Todos os registros e eventos serão fictícios. O canal escolhido é Telegram, com Flue na Cloudflare. Simulador local permite desenvolver antes da criação do bot. Datas podem avançar em relógio simulado, sinalizado como tal. Não é necessário consumir API acadêmica ou gabarito de simulado.

A identificação do produto é necessária para entender a avaliação, mas um catálogo fictício é suficiente. Em operação real, combinar como identificar alunos/produtos e obter permissão de contato; isso não implica integrar progresso de aulas.

O feedback é percepção declarada, não comprovação de equivalência objetiva nem de eficácia pedagógica. Resultado e avaliação permanecem independentes. Critérios detalhados nas [histórias](../referencias/historias-de-usuario.md).
