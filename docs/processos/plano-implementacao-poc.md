# Plano de implementação — POC Telegram

24/10/2026. Classe FULL por autenticação, agenda, persistência e efeitos externos. Contrato de produto: [PRD](../referencias/prd-poc.md); execução autorizada, dados fictícios. Canal Telegram/Cloudflare/Flue escolhidos pelo responsável. Sem bot, desenvolver e verificar simulador sem alegar E2E real.

## Escolhas técnicas e revisão

TypeScript; Flue 2.3.0 (runtime/canal verificado), Vite, Hono; Worker com D1 para registro, eventos e agenda/outbox. Cron limitado processa ações vencidas. Sem LLM no caminho crítico: Flue integra canal, não decide respostas acadêmicas. Sem agente de ajuda adicional nesta fatia; não há valor demonstrado que justifique custo/inferência. Não montar router público de agentes.

Revisão independente atacou projeto antes da implementação. Incorporar: allowlist privada e chat privado além de webhook secret; callbacks vinculados à revisão; outbox com ID e schedule_revision; envio sem retry cego após timeout; segredos separados para consulta e demo; datas civis com fuso e horário explícito; modo demo restrito a perfis fictícios e ações enumeradas.

Ponto de não retorno: uma tentativa em `sending` pode já ter sido aceita pelo provedor e não é cancelável com garantia. Pausa/remarcação invalidam ações ainda pendentes; revalidar imediatamente antes de dispatch. Uma entrega incerta permanece visível como `unknown`. Não prometer exactly-once do efeito externo.

## Etapa 1 — Base reproduzível

Arquivos: package.json/lock, tsconfig.json, vite.config.ts, flue.config.ts, wrangler.jsonc e src/app.ts a partir de scaffold Flue em diretório temporário, incorporado sem sobrescrever documentação/AGENTS. Dependencies exatas. Configuração pública sem conta/chats/tokens pessoais; `.dev.vars` ignorado.

Verificar: instalação, checagem de tipos/build. Sem release/tag automática; metadata de aplicação começa em 0.0.1 e changelog mantém Unreleased até marco de release. Rollback: retirar somente scaffold novo, sem dados remotos preexistentes.

## Etapa 2 — Domínio e questionário

Arquivos: src/domain/survey.ts e tests/domain/survey.test.ts. Interfaces canônicas:

- `SurveyState`: participantId, attemptId, revision, scheduleRevision, step, examDate/candidateDate/dueAt, attendance, result, paused, courseUsed/courseAlignment, simulationUsed/simulationContent/simulationFormat/simulationDifficulty, comment.
- `SurveyEvent`: `{kind:'text'|'choice', value:string}` ou `{kind:'followup'}`.
- `createSurvey(participantId:string, attemptId:string):SurveyState`.
- `transition(state:SurveyState,event:SurveyEvent,now:Date):SurveyResponse`.
- `SurveyResponse`: `{state:SurveyState,message:string,buttons:Array<{text:string,value:string}>}`.

Regras: mensagens slash /start /data /cancelar /pausar /retomar /resultado /resumo; data confirmada com botão, YYYY-MM-DD válido e futuro até 730 dias; contato D+1 às 10h America/Fortaleza para a demo. Sem data não programa contato. Roteiro principal: date → confirm_date → scheduled → attendance → result → course_use → course_alignment (se usou) → simulation_use → simulation_content/format/difficulty (se usou) → comment → done. Correção /resultado retorna ao ponto anterior sem apagar avaliações. /data não apaga feedback. Se tentativa já realizada, nova prova exige nova tentativa separada via serviço, não mutação destrutiva.

RED: datas impossíveis e passada, confirmação ambígua, caminho completo, remarcação, pausa, ausência, resultado pendente, não uso, correção e comentários limitados a 1000 caracteres. Implementar mínimo e executar `node --experimental-strip-types --test tests/domain/survey.test.ts`. Sem dependência de modelo/banco/token. Não importar modelos de dados de outras organizações.

## Etapa 3 — Persistência e fronteiras HTTP

Arquivos: src/storage.ts, src/service.ts, src/telegram.ts, src/app.ts, migrations/0001_initial.sql; tests/storage e tests/http. Interface: `handleAuthorizedInput` aplica domínio a chat/participante já verificado; sender injetável aceita mensagem e botões canônicos. Banco relaciona participante à tentativa atual; preserva anteriores; CAS de revision evita sobrescrita; dedup por bot/update ID; callbacks validados por nonce/revisão atual.

RED: requests sem segredo e chat não permitido não persistem; evento duplicado não reaplica; callback velho não altera nova revisão; comentários não viram HTML executável; leitura/demo usam credenciais distintas; resposta parcial persiste. Testar o SQL com SQLite/D1 real local, não somente repositório fake. Comando de suíte `npm test`, checagem `npm run typecheck`.

## Etapa 4 — Agenda, envio e demonstração

Arquivos: src/scheduler.ts, src/sender.ts, src/demo.ts e tests/scheduling. Outbox pending→sending→sent|unknown; guardar message_id quando houver; claim condicional em revisão/pausa; jobs velhos cancelados. Crash/timeout após chamada permanece unknown, sem retry automático. Claim máximo 20 por passagem; índice status/dueAt. Simulador usa fronteira autorizada e senderfake com captura de mensagens; demo manipula apenas cenário enumerado e avanço individual, nunca relógio público/global.

RED: reinício, duplicidade, cancelamento/remarcação/pausa antes do envio, claim concorrente, envio incerto, expiração e cenários A/B do PRD. Verificar suite e build; registrar ponto de não retorno.

## Etapa 5 — Consulta e evidência

Arquivos: src/operator.ts, public ou template de página, tests/operator, docs/solucoes/poc.md e guia de setup. Interface discreta: fonte de sistema, fundo claro, uma cor de destaque, tabela legível e contagem separada de pendência/não uso. Token em header/memória da sessão, nunca URL/localStorage/HTML. Responses no-store/noindex/CSP, texto via textContent/escape. Endpoint de demo separado e segredo próprio.

RED: operador sem credencial não lê resultados, avaliações independentes e agregados têm denominadores explícitos; filtro não expõe chat IDs desnecessários. Verificar resposta do Worker e renderização da lista com dados fictícios.

## Etapa 6 — Fechamento e integração externa

Executar suíte, typecheck, build, revisão independente do diff e varredura de publicação genérica. Configurar somente recursos exclusivos na conta confirmada. Sem bot: deploy pode ficar sem webhook/envio real, sem anunciar E2E validado. Quando credencial exclusiva chegar, verificar getMe e webhook e testar participante autorizado; não reutilizar webhook de outro projeto. Abrir PR e anexar ao chat se houver PR. Não publicar segredos ou links de acesso.

## Evidência e progresso

- PRD criado; goal ativo; bot não existe e não bloqueia implementação/simulação.
- Harness v3.10.2 instalado. A versão do core local anterior estava defasada; instalação usou release remota atual em nova pasta vendorizada, sem alterar a cópia de origem.
- Fase atual: implementação local concluída; domínio, SQL, HTTP, serviço e cron testados. Revisão final/publicação remota pendentes.
- Ruling: handlers nativos de Cron ficam em src/cloudflare.ts, não apenas no objeto de app.ts. O evento scheduled real no workerd foi observado falhando e depois passando com outcome=ok.
