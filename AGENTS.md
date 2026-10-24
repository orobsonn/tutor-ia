# Instruções do repositório

## Produto e comunicação

- Escrever documentação em português, com linguagem de produto e evidências datadas.
- O escopo vigente está em `docs/estado-atual/escopo-poc.md`. A visão futura não é compromisso de implementação.
- Separar fato verificado, decisão, proposta, pendência e histórico. Documentação pronta não significa software implementado.
- Não transformar relato de aderência em equivalência objetiva entre curso, simulado e prova.

## Publicação

- Este repositório é público. Publicar somente material genérico e exemplos próprios, explicitamente fictícios.
- Não incluir identidades de organizações atendidas, pessoas envolvidas, alunos reais, telefones, mensagens, credenciais, links privados ou arquivos recebidos de terceiros.
- Não copiar acervos locais ou histórico privado para este Git. Revisar conteúdo, nomes de arquivos e histórico antes de publicar.

## Organização

- Uma página responsável por assunto; índices resumem e apontam para ela.
- Mudança de escopo atualiza estado, histórias, processos e backlog afetados. Registrar a decisão e arquivar o recorte substituído.
- ADRs registram contexto, decisão, alternativas, consequências e pendências. Não inventar aceite de terceiros.

## Antes de implementar

- Seguir as instruções do operador sobre onboarding e atualização do harness de delivery vendorizado em `.Codex/`. Esta base documental ainda não tem harness; não iniciar entrega de código sem resolver o onboarding.
- Escolhas técnicas não triviais precisam de revisão adversarial antes de fechamento, conforme instruções do operador.
- A autorização atual cobre criação do repositório e documentação. Não conectar contas, enviar mensagens ou operar com dados reais por inferência.
- Ao iniciar a aplicação, configurar `package.json` e versionamento de acordo com a política de releases do operador, mantendo o changelog. Não há release ou tag publicada nesta etapa documental.
