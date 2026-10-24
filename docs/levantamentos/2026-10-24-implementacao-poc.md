# Implementação e evidência — 24/10/2026

Status: desenvolvimento em andamento, antes da revisão final e publicação remota.

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

## Limites

Não é E2E do Telegram: token/bot inexistentes. Não há efeito externo de envio na simulação, não há dados acadêmicos reais e não foi verificada eficácia pedagógica. Deploy remoto, revisão final e execução da CI serão registrados quando ocorrerem, sem retroagir alegações.

## Revisão independente e correções

A revisão final inicial pediu alterações: revogação da allowlist no envio, distinção de data pretendida, cenário C/correção, limite total do cron, rejeição de segredos iguais, confirmação tardia e denominadores dos indicadores. Foram adicionadas correções e testes direcionados; nova revisão independente está em andamento.

O cron nativo foi reexecutado no workerd local e retornou outcome=ok. CI do PR passou na revisão anterior; deverá rodar novamente para as correções. Nenhuma alegação de Telegram real decorre desses testes.
