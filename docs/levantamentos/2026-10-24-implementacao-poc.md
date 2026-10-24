# Implementação e evidência — 24/10/2026

Status: implementação revisada e publicada; ciclo principal verificado no Telegram real com dados fictícios e vencimento isolado antecipado. Homologação humana pendente.

## Contrato e decisões

PRD consolidado; execução autorizada com Telegram, Cloudflare e Flue. Bot ainda não foi criado; responsável confirmou que isso não deveria bloquear desenvolvimento independente. Harness Codex v3.10.2 vendorizado a partir da release atual. Nenhum dado de cliente ou aluno foi importado.

A revisão adversarial anterior ao código resultou em: allowlist privada além de segredo do webhook; botões vinculados à tentativa/revisão; outbox e dedup; ponto de não retorno do envio; segredos distintos para leitura/demo; data civil e horário explícito; ausência de LLM no caminho crítico.

## Evidências locais

- Domínio: 12 testes, incluindo RED de ordem de perguntas seguido de GREEN.
- Storage: SQL da migração executado em SQLite real; CAS, dedup, histórico, pausa, envio incerto, crash e separação de modos. RED de starvation por cenários simulados seguido de correção.
- HTTP: RED de rotas ausentes, demonstração não implementada e script de página inválido; GREEN após implementar os respectivos comportamentos.
- Serviço/agenda: RED de identificação fictícia ausente na primeira mensagem; GREEN após correção.
- Migração aplicada apenas ao D1 local; 10 comandos executados.
- workerd via Vite: health 200, consulta sem token 401 e cenários A/B completos persistidos no D1 local.
- Resultado A aprovado com curso muito/simulado em parte; B pendente e não uso de simulados preservado como null nas avaliações.
- Verificação visual da página e execução do botão de consulta sem credencial confirmam layout e bloqueio. Foi corrigido escape do script; teste de parse do JavaScript entregue protege regressão.
- Auditoria npm: dependências transitivas e ferramentas atualizadas/ajustadas a versões compatíveis verificadas; zero vulnerabilidades reportadas na última verificação local, inclusive conjunto completo. Não é garantia sobre futuras divulgações.

## Integração do Cron

O teste real de evento scheduled no runtime local retornou outcome=exception: o Flue não exporta handlers não HTTP declarados apenas em app.ts. O cron foi movido para src/cloudflare.ts, ponto de extensão nativo do framework; revalidar o evento no runtime e manter teste desse entrypoint.

## Limites registrados antes da conexão do bot

Não é E2E do Telegram: token/bot inexistentes. Não há efeito externo de envio na simulação, não há dados acadêmicos reais e não foi verificada eficácia pedagógica. A evidência remota abaixo se refere ao simulador autenticado, sem entrega real de mensagens.

## Revisão independente e correções

A revisão final inicial pediu alterações: revogação da allowlist no envio, distinção de data pretendida, cenário C/correção, limite total do cron, rejeição de segredos iguais, confirmação tardia e denominadores dos indicadores. As correções foram validadas por revisão independente, incluindo preservação da ausência e remarcação para outra data; resultado final APPROVE, sem achados no delta.

O cron nativo foi reexecutado no workerd local e retornou outcome=ok. CI do PR passou também para as correções. Nenhuma alegação de Telegram real decorre desses testes.

## Evidência final e publicação remota

- Commit de aplicação publicado: `3c1bbe1`; 44/44 testes locais, typecheck, build e CI aprovados.
- Worker exclusivo com binding D1 e cron de cinco minutos; deployment ativo confirmado a 100% na versão `c161887a-5d2f-433c-9ad9-e1dec451404a`. IDs de conta/banco e credenciais não foram versionados.
- Migração remota inicial executou 10 comandos no banco exclusivo.
- Health remoto 200 com Telegram não configurado; consulta sem credencial 401; página com CSP restritiva.
- Cenário A: data remarcada com novo vencimento, prova realizada, aprovação e avaliações separadas.
- Cenário B: resultado pendente com não uso de simulados, depois correção para aprovação preservando feedback.
- Cenário C: pausa impede followup; retomada e ausência não abrem avaliação. Cancelamento posterior é rejeitado; nova tentativa permite cancelamento preservando a ausência anterior.
- Quatro tentativas persistidas e consultadas novamente por HTTP. Consulta direta ao D1 confirmou que a entrega cancelada corresponde ao followup do cenário pausado.
- A primeira asserção remota exigia apenas status simulated e falhou diante desse cancelamento correto. A evidência foi reconciliada sem repetir as ações: 41 entregas simuladas e um followup cancelado, todos do modo demo; nenhum envio real.
- Credenciais de leitura e demonstração distintas, mantidas somente em configuração privada. Nenhum webhook de outro projeto foi alterado.

Homologação no Telegram continua condicionada ao bot exclusivo: getMe, configuração do webhook e ciclo real com participante autorizado ainda não foram executados.

## Auditoria de requisitos da implementação

| Requisito | Evidência | Limite |
|---|---|---|
| RF01 — produto/data | Perfil fictício identificado na primeira resposta; testes de data marcada, pretendida, sem data e confirmação tardia | Produto único da demonstração |
| RF02 — alteração/histórico | Testes SQL/serviço e cenário A remoto; C preserva ausência e cancelamento em tentativas distintas | Sem alunos reais |
| RF03 — contato pós-prova | Testes de agenda/realização, handler scheduled no workerd e cron registrado no deploy | Envio real de Telegram pendente |
| RF04 — resultado/correção | Testes de domínio e correção B remota preservando avaliações | Resultado declarado |
| RF05/RF06 — curso/simulados | Questionário completo A, não uso B, comentário e dimensões separados; testes HTTP/domínio | Percepção, não equivalência objetiva |
| RF07 — consulta | Auth/CSP remotos, listagem saneada e métricas testadas com denominadores | Visão interna simples |
| RF08 — pausa/retomada | Cenário C remoto e followup cancelado confirmado diretamente no D1 | Janela sending documentada |
| RF09 — persistência/dedup | Testes SQLite/CAS/updates repetidos; registros remotos relidos e histórico preservado | Timeout externo permanece incerto |
| RF10 — demo | A/B/C executados por HTTP com relógio individual e sender simulado | Bot exclusivo ainda inexistente |

Entregáveis de código, PRD, configuração, harness, revisão, testes/build, documentação e publicação da demonstração foram verificados. O aceite de canal real previsto no item 6 da definição de pronto permanece explicitamente condicionado à disponibilidade do bot.

## Conexão inicial do Telegram — atualização de 24/10/2026

Com autorização do responsável, o bot exclusivo foi criado no BotFather pelo Chrome conectado. Identidade validada por getMe; getWebhookInfo confirmou ausência de webhook anterior antes de configurar o endpoint exclusivo. Token, segredo do webhook e único ID de participante autorizado ficaram em configuração privada.

O participante iniciou /start no Telegram real. O Worker respondeu identificando Curso Alfa/Certificação Alfa e os dados fictícios. O botão assinado “Ainda não tenho data” foi acionado pelo chat; a consulta autenticada confirmou uma tentativa em transporte Telegram, estado sem data e sem contato agendado. Entregas reais desse teste têm status sent; webhook sem pendências ou erro. Isso comprova ingresso, resposta, callback e persistência iniciais — não o ciclo pós-prova completo.

A tela da equipe passou a chamar o bloco de demonstração “Simular conversa com aluno”, explicando o efeito dos cliques e distinguindo esses controles da rotina operacional.

## Teste completo do ciclo principal pelo Telegram — 24/10/2026

Solicitado explicitamente pelo responsável. Foi criada uma tentativa fictícia separada via /nova, informada a data 25/10/2026 e confirmada como marcada pelos botões reais do Telegram.

Para simular a passagem dos dias, somente due_at e dueAt do JSON dessa tentativa foram antecipados, com condição de participante, tentativa, revisão, estado e conteúdo anterior exatos. A alteração atingiu uma única linha. Nenhum relógio global, configuração do cron, autorização ou outra tentativa foi modificado. O vencimento original e o snapshot anterior ficaram preservados em evidência privada. Isso é aceleração de fixture de teste, não comprovação de que dias reais transcorreram.

O cron publicado enviou “Você realizou a prova prevista?” às 12h15 no fuso America/Fortaleza. Todos os passos seguintes ocorreram pelo Chrome/Telegram, com os botões reais assinados e o comentário enviado pelo chat:

| Campo | Resposta fictícia confirmada no registro persistido |
|---|---|
| Realização | Realizou |
| Resultado | Aprovado; recebeu parabéns sem oferta |
| Curso | Utilizou; conteúdo correspondeu muito |
| Simulados — uso/conteúdo | Utilizou; correspondeu em parte |
| Simulados — formato | Pouco parecido |
| Dificuldade relativa | Prova mais difícil que os simulados |
| Comentário | Relato identificado como teste fictício sobre conteúdo, formato e dificuldade |
| Encerramento | Estado done; mensagem “Respostas registradas. Obrigado!” |

A consulta autenticada foi relida e comparada campo a campo com as respostas. Consulta direta ao D1 confirmou exatamente um followup sent e doze respostas reply sent nessa tentativa. Webhook sem pendências e sem erro. A tentativa finalizada não é elegível para novo contato agendado.

Comprovação visual e identificadores técnicos permanecem em arquivo privado. Não houve alteração no código da aplicação nem novo deploy para esse teste. O resultado valida o caminho principal completo com transporte real; os casos alternativos têm a evidência simulada/automatizada já descrita, sem alegar que todos foram repetidos no Telegram.

## Revisão da consulta da equipe — 24/10/2026

A pedido do responsável de produto, a tabela larga foi substituída por fichas responsivas. Resultado/data/realização, curso, dimensões dos simulados e comentário são apresentados em blocos legíveis. Indicadores detalhados ficam recolhidos; os denominadores e as distinções de não uso/ausência de resposta foram preservados.

A área “Simular conversa com aluno” e sua credencial/controles foram retiradas da consulta. A API técnica restrita permanece para os testes existentes. O bot continua determinístico, sem IA generativa; essa alteração é de apresentação da consulta.

Verificação desta revisão: 44/44 testes, tipos, build e CI aprovados. Inspeção de layout em 600 e 390 pixels confirmou scrollWidth igual a clientWidth, inclusive nas fichas. Após publicar, a consulta carregou as seis tentativas preservadas; a ficha do teste completo pelo Telegram exibiu resultado, curso, três dimensões dos simulados e comentário. A página publicada não contém tabela nem chamadas à API de simulação, e a configuração do Telegram foi preservada.

## Legibilidade das mensagens — 24/10/2026

Mensagens do Telegram reorganizadas em blocos curtos, com perguntas identificadas, confirmações mais claras e resumo em português das avaliações. Datas e vencimentos são exibidos em formato brasileiro e no fuso configurado. A entrada DD/MM/AAAA é normalizada para o mesmo ISO canônico já usado pelo domínio; o formato ISO anterior continua aceito. Datas impossíveis ou ambíguas seguem rejeitadas.

A liberação de um novo avaliador depende da identificação exata de sua conta. A allowlist e a separação entre leitura e mutação não foram alteradas nesta revisão.

Verificação desta revisão: 47 testes, tipos, build e CI aprovados. O resumo foi solicitado no Telegram real e recebido com blocos em português, data brasileira e avaliações preservadas. Um avaliador foi identificado pelo contato exato já salvo no Telegram; seu ID numérico foi acrescentado à configuração privada, preservando o responsável. Não houve abertura pública do bot nem mensagem enviada ao avaliador. A identidade do avaliador e a credencial de consulta ficaram fora do Git; o início de teste por essa nova conta ainda depende do próprio avaliador.
