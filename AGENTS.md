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

- Seguir as instruções do operador sobre onboarding e atualização do harness de delivery vendorizado em `.Codex/`. Harness Codex v3.10.2 instalado; aplicar entry-policy e contratos vendorizados antes de entrega de código.
- Escolhas técnicas não triviais precisam de revisão adversarial antes de fechamento, conforme instruções do operador.
- A implementação da POC foi autorizada em 24/10/2026 com Telegram, Cloudflare e Flue, somente dados fictícios. Conectar apenas recursos exclusivos desta demonstração; não enviar mensagens a terceiros ou operar com alunos reais por inferência.
- Ao iniciar a aplicação, configurar `package.json` e versionamento de acordo com a política de releases do operador, mantendo o changelog. Não há release ou tag publicada nesta etapa documental.

<!-- harness:start — managed by initializing-projects, do not edit inside -->
# Codex Delivery Harness

Operator-facing communication is pt-br, short, and product-oriented.

On each top-level request, invoke `harness-triage`. For LIGHT/FULL work, use
`harness-brainstorming`, obtain approved design, then `harness-planning`.
Implementation uses `harness-delivery` with the explicit route from
`.codex/model-routing.mjs`.

Eyes are read-only and hands follow the current parent permission mode. The
sandbox and approval policy are the security boundary; hooks and rules are only
additional rails. Never claim that a hook proves role identity, isolates a
same-user process, or undoes a completed side effect.

Before closing a non-trivial design, run a read-only adversary review. Before
claiming completion, run the applicable tests and completion audit.

`MEMORY.md` is the committed, durable project-memory index and `kaizen.md` is
the committed improvement log. Record only verified, reusable and non-secret
knowledge; never treat transient agent context as durable memory.
<!-- harness:end -->
