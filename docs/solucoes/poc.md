# POC Telegram — funcionamento e execução

Atualizado em 24/10/2026. Código implementado e ciclo demonstrado no runtime local workerd com D1 local. Integração real do Telegram e deploy remoto permanecem separados no [estado do projeto](../estado-atual/projeto.md).

## Implementado

- Pesquisa guiada, sem LLM no caminho crítico, com datas, confirmação/remarcação, realização, resultado, curso e simulados.
- Flue 2.3.0 integra o ingresso verificado do Telegram e o build Cloudflare. Não há agente autônomo ou router de conversa público; não foi adicionada inferência só para preencher formulário.
- Persistência de tentativas, eventos e outbox em D1; conflito de revisão e repetição de update não sobrescrevem estado.
- Contato ilustrativo D+1 às 10h America/Fortaleza; agenda processada por cron a cada cinco minutos, sem modificar relógio global.
- Consulta da equipe e simulador de cenários A/B com segredos distintos.
- Sender simulado para cenários; sender Telegram exclusivo para participantes permitidos, depois da configuração.

## Rodar localmente

Requer Node 22.19 ou superior, compatível com a versão fixada do framework.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Preencher credenciais locais fora do Git; não colar valores em issues/commits.
npx wrangler d1 migrations apply DB --local
npm run dev -- --host 127.0.0.1
```

Abrir o endereço local informado pelo Vite. Informar credencial de leitura para consultar e credencial de demonstração para avançar os cenários. Elas permanecem somente na memória da página; não são gravadas em URL, HTML, log ou localStorage. Sem bot, deixar credenciais Telegram vazias; o simulador continua disponível.

```sh
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

O ID de banco no wrangler.jsonc versionado é um placeholder de desenvolvimento. A configuração de deploy deve apontar exclusivamente para o banco criado para esta POC, sem incluir identificação pessoal da conta no Git.

## Configuração privada do Telegram

Usar bot exclusivo, criado pelo responsável da conta. Nunca redirecionar webhook de outro projeto. Variáveis privadas: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET_TOKEN e TELEGRAM_ALLOWED_USER_IDS (IDs numéricos exatos, separados por vírgula, não usernames). O participante precisa iniciar o chat privado com /start. Negar grupos, usuários não autorizados e remetente diferente do chat.

Registrar webhook somente após verificar getMe do bot e publicar o endpoint desta POC: `/channels/telegram/webhook`, com secret_token próprio e updates de mensagens/callbacks. URLs, tokens e IDs privados ficam fora desta documentação pública. Código de ingress/sender está implementado, mas isso não comprova que um bot real já foi conectado.

Comandos: /start, /data, /pausar, /retomar, /cancelar, /resultado, /resumo e /nova. /nova cria tentativa separada, preservando a anterior. Datas fechadas AAAA-MM-DD e botões assinados evitam depender de interpretação livre. Uma pergunta antiga não pode alterar revisão nova.

## Consulta e demonstração

- `GET /`: página sem dados/credenciais embutidos.
- `GET /health`: saúde básica; não é teste completo de persistência.
- `GET /api/records`: Authorization Bearer com OPERATOR_READ_TOKEN; lista saneada, sem expor IDs de chat.
- `POST /api/demo`: Authorization Bearer com OPERATOR_DEMO_TOKEN; cenário A/B e ação enumerada next/reschedule/pause/resume/cancel; sem parâmetros de timestamp ou participante livres.

Todos os exemplos acadêmicos são fictícios. A flag interna de modo distingue transporte simulado de Telegram; mesmo no Telegram, produto/certificação desta POC continuam fictícios. O operador não deve inserir dados acadêmicos reais nesta etapa.

## Entrega incerta e limites

Outbox pending → sending → sent/simulated/unknown. Pausa/remarcação invalidam contatos ainda pendentes; o sistema revalida estado antes da chamada externa. Depois de sending, o provedor pode já ter aceitado e não há garantia de cancelamento. Timeout/crash vira unknown, sem retry automático. Isso privilegia não duplicar e pode exigir reconciliação pelo operador.

A recuperação de sending antigo ocorre após dois minutos, sem reenvio. Jobs simulados não concorrem com o lote do Telegram. A leitura da equipe é intencionalmente simples e adequada à pequena demonstração; não é painel multicliente ou integração CRM.

Ainda não há comprovação de getMe, setWebhook, recebimento e entrega reais. A revisão final e a evidência datada indicam o que efetivamente foi verificado.
