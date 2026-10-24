# PRD — POC Tutor IA

Data: 24/10/2026. Status: requisitos consolidados a partir do escopo adotado; implementação autorizada pelo responsável do projeto. Não representa homologação da demonstração. Fonte de escopo: [POC](../estado-atual/escopo-poc.md), [histórias](historias-de-usuario.md) e [decisões](../decisoes/README.md).

## 1. Problema e resultado esperado

Hoje o desenho não conta com um fluxo executável para descobrir a data da prova, obter resultado declarado e registrar a percepção do aluno sobre a aderência do curso/simulados ao encontrado na prova. A POC deve demonstrar esse ciclo e disponibilizar respostas organizadas à equipe.

Sucesso da POC: um participante autorizado, representando aluno fictício, completa o fluxo no Telegram; data/remarcação, pesquisa, resultado e respostas persistem; a equipe consegue consultar os registros e sua situação. Não se pretende demonstrar ganho de aprovação ou equivalência objetiva entre materiais e prova.

## 2. Escolhas confirmadas

- Canal: Telegram.
- Hospedagem: conta Cloudflare do responsável do projeto.
- Framework: Flue; versão estável verificada e fixada antes da implementação.
- Dados acadêmicos: exclusivamente fictícios, com Curso Alfa e Certificação Alfa.
- Não depender de API de aulas, progresso ou banco de questões.
- Repositório e documentação públicos e genéricos; credenciais, identidades de chats/contas e registros coletados ficam fora do Git.

Atualização de 24/10/2026: bot exclusivo criado e conectado; /start e callback assinado verificados com persistência. O ciclo pós-prova completo pelo Telegram real ainda precisa ser executado. A implementação/simulação foi construída antes da disponibilização do bot.

## 3. Usuários e entrada

- Participante: assume um perfil fictício para demonstrar a experiência no chat privado.
- Operador: configura a demonstração, avança o tempo de forma explícita e consulta respostas.

A POC não é um bot público de pesquisa irrestrita: acesso de demonstração e consulta de resultados são restritos. Um participante não pode operar a tentativa de outro ou avançar o relógio global. Não há campanhas para contatos sem interação inicial.

## 4. Escopo funcional e critérios de aceite

| ID | Requisito | Aceite observável |
|---|---|---|
| RF01 / US01 | Registrar prova/data | Seleção de produto/certificação fictícios; marcada, pretendida e sem data distintos; data válida confirmada |
| RF02 / US02 | Alterar/remarcar/cancelar | Alteração substitui o contato antigo; cancelamento o remove; tentativas passadas preservadas |
| RF03 / US03 | Contato pós-prova | Em D+X, perguntar se realizou antes de perguntar aderência; ausência/remarcação/cancelamento não geram avaliação |
| RF04 / US04 | Resultado | Aprovado/reprovado/pendente e desconhecido distintos; origem declarada; correção não duplica tentativa |
| RF05 / US05 | Curso | Uso confirmado; aderência de conteúdo muito/em parte/pouco/não consigo avaliar; não uso distinto; comentário opcional |
| RF06 / US06 | Simulados | Uso confirmado; conteúdo e formato separados; dificuldade relativa mais fácil/semelhante/mais difícil/não consigo comparar; não uso pula avaliação |
| RF07 / US07 | Visão da equipe | Lista restrita por produto/prova com respostas, comentários, pendências e contagens; dados fictícios sinalizados |
| RF08 | Pausa/retomada | Pausa impede novos contatos programados; retomada explícita; silêncio não vira reprovação |
| RF09 | Persistência | Reinício não perde respostas ou agenda; webhook/evento repetido não cria duas tentativas nem reenvio deliberado |
| RF10 | Demonstração rápida | Operador avança tempo de forma controlada para disparar contato devido sem aguardar dias; eventos simulados identificados |

D+1 é o valor ilustrativo inicial da demonstração; o intervalo operacional não foi validado. Data é tratada no fuso configurado, inicialmente America/Fortaleza; sem horário informado, não presumir que o aluno acabou de realizar a prova à meia-noite.

## 5. Fluxo principal

Iniciar chat → perfil fictício/produto → situação/data de prova → confirmar → aguardar data ou alteração → contato pós-prova → realização → resultado → uso/avaliação do curso → uso/avaliação dos simulados → comentário opcional → confirmação de registro.

Aprovado recebe parabéns, sem oferta. Reprovado recebe acolhimento, sem culpa ou promessa de aprovação. Resultado pendente não impede feedback de prova realizada e pode ser atualizado depois. Feedback parcial permanece salvo. Perguntas fechadas e validações determinísticas são preferidas; não depender de interpretação livre para alterar estados ou datas. IA, se utilizada no Flue, não decide autorização, resultado, data final ou envio livre.

## 6. Visão da equipe

Uma consulta/lista simples, autenticada e não indexável como conteúdo público, basta. Apresentar realização, resultado e avaliações separadamente, com quantidade de respondentes. Não usou/não respondeu/não sabe avaliar não entram como avaliações negativas. Preservar correção e identificação de tentativa. Não é necessário CRM, relatório sofisticado ou dados reais de alunos.

## 7. Cenários obrigatórios de demonstração

- A: prova remarcada; novo contato substitui o antigo; aluno realiza, informa aprovação, avalia curso bem e critica formato/dificuldade dos simulados.
- B: prova realizada; resultado pendente; aluno avalia curso e informa que não usou simulados.
- C: ausência ou cancelamento não abre avaliação; pausa impede novo contato; correção de resultado fica refletida na lista.

Exemplos de pesquisa e dados: [dados e perguntas](dados-e-perguntas.md), [cenários](exemplos/cenarios.json). Roteiro: [demonstração](../processos/demonstracao-poc.md).

## 8. Fora do escopo

Planos/rotina, consumo de aulas, recuperação de inatividade, revisão por questões, tira-dúvidas/ingestão, alunos reais, coleta de questões reais de prova, campanhas, ofertas, múltiplos clientes e homologação de integração acadêmica.

## 9. Entregáveis e definição de pronto

1. Código e configuração reproduzíveis para Flue/Cloudflare, com dependências fixadas e sem segredos versionados.
2. Fluxo Telegram com agenda e estado persistentes e consulta restrita para a equipe.
3. Modo de demonstração/simulador capaz de exercitar o ciclo sem token real.
4. Testes de realização/resultado, remarcação, pausa, não uso, feedback parcial, evento repetido e acesso indevido.
5. Build e checagem de tipos aprovados; documentação de execução, setup privado e evidência datada.
6. Quando o bot estiver disponível: verificar identidade via getMe, configurar webhook exclusivo, executar o ciclo com participante de demonstração autorizado e comprovar resposta persistida. Sem isso, marcar integração real como pendente, não pronta.

## 10. Pendências e escolhas de implementação

Bot exclusivo e credenciais foram configurados de forma privada; nenhum token será solicitado em issue ou commit. Identificação/ativação de participantes e operador será definida sem publicar IDs pessoais. Não redirecionar bot ou webhook de outro projeto.

Conta Cloudflare, runtime Flue, armazenamento, agenda e proteção do operador devem ser verificados antes do deploy. Arquitetura não trivial passa por revisão adversarial. Não contratar capacidade adicional nem mudar outros projetos por inferência. A ausência do bot não bloqueia o trabalho independente.
