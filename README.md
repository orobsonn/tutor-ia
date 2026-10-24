# Tutor IA

Acompanhamento de provas e coleta de feedback sobre a preparação oferecida por cursos e simulados.

**Estado em 24/10/2026:** POC implementada e publicada em ambiente exclusivo de demonstração na Cloudflare; cenários fictícios validados por HTTP com persistência. Telegram real e homologação humana ainda pendentes. Este repositório é público e contém documentação genérica, sem registros de alunos, conversas ou documentos de organizações.

## Comece pela pergunta

| Sua pergunta | Leia |
|---|---|
| Qual é o documento de requisitos? | [PRD da POC](docs/referencias/prd-poc.md) |
| O que vamos demonstrar agora? | [Escopo vigente da POC](docs/estado-atual/escopo-poc.md) |
| Como o recorte atual se compara à visão futura? | [Atual × visão-alvo](docs/estado-atual/escopo-atual-e-visao-alvo.md) |
| Quais são as histórias e os critérios de aceite? | [Histórias de usuário](docs/referencias/historias-de-usuario.md) |
| O que está pronto e o que continua pendente? | [Estado do projeto](docs/estado-atual/projeto.md) |
| Por que escolhemos esse foco? | [Registro de decisões](docs/decisoes/README.md) |
| O que será mostrado na demonstração? | [Roteiro da POC](docs/processos/demonstracao-poc.md) |
| Quais respostas precisamos antes de implementar? | [Perguntas e próximos passos](docs/backlog/perguntas-em-aberto.md) |

## Organização

| Pasta | Responsabilidade |
|---|---|
| [Estado atual](docs/estado-atual/README.md) | Recorte vigente e situação verificável |
| [Referências](docs/referencias/README.md) | Conceitos, histórias e exemplos fictícios |
| [Processos](docs/processos/README.md) | Jornada proposta e demonstração |
| [Soluções](docs/solucoes/README.md) | Estado da solução e limites daquilo que existe |
| [Decisões](docs/decisoes/README.md) | Escolhas aceitas, alternativas e consequências |
| [Levantamentos](docs/levantamentos/README.md) | Sínteses datadas que sustentam as escolhas |
| [Backlog](docs/backlog/README.md) | Pendências e evoluções sem compromisso de entrega |
| [Arquivo](docs/arquivo/README.md) | Recortes substituídos, claramente históricos |

## Limite da proposta

A POC pergunta a data da prova, faz contato depois, registra realização/resultado e coleta a percepção do aluno sobre a aderência do curso e dos simulados. Ela não compara objetivamente questões de provas e não promete aprovação.

Há implementação e simulador local/remoto com persistência; o Telegram real ainda não foi conectado. [Como executar e configurar](docs/solucoes/poc.md). A construção usa Telegram, Flue e Cloudflare; o bot exclusivo ainda não foi criado. Regras de manutenção: [AGENTS.md](AGENTS.md). Mudanças: [CHANGELOG.md](CHANGELOG.md).
