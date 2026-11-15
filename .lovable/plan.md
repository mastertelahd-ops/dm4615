# Auditoria DM4615 — integração com o agente Windows .NET

## Divergências reais encontradas

1. **PON fixa no frontend.** `src/lib/agent-api.ts` define `VALIDATED_PON = "1/1/2"`, `assertPon` bloqueia qualquer outra PON e `PON_INVENTORY` tem só 10 portas (DM4615 tem 16). O painel só consulta 1/1/2 e exibe as outras como "inventário".
2. **`parsed` é ignorado.** `CollectResult.parsed` é `unknown`; o painel só mostra o JSON bruto. A tabela de ONUs em `painel.tsx` (~L420-510) lê estados por regex sobre `raw` e cruza com a lista fixa de `src/lib/olt-snapshot.ts`.
3. **Dados fixos que parecem reais.** `olt-snapshot.ts` traz ZTEGC4FFAB0A e ZYXE8CAF45DD marcadas como "Down". O real é ZTEGC4FFAB0A Up. Precisa sair da UI operacional.
4. **Allowlist da CLI.** `READ_ONLY_COMMANDS` só tem os dois comandos de 1/1/2. Precisa virar um gerador `show interface gpon 1/1/N` e `... onu` para N de 1 a 16.
5. **Cópia do agente no repositório está desatualizada.** `src/agent/Program.cs` só aceita 1/1/2 e devolve `parsed = null`, enquanto o agente instalado já atende 16 PONs com `parsed`. Também existe `agent/app.py` (Python, rota `/api/v1/connection/test`), que é legado e diverge do contrato. O formato exato de `parsed` não está no repositório: **esse é o primeiro bloqueio a confirmar**, com um JSON real de cada endpoint.
6. **`/health`.** O agente responde `status: "online"`, mais o campo `oltCommandsEnabled`. Se `DM4615_ENABLE_READ_COMMANDS` não estiver ligado, as capabilities vêm vazias e o painel bloqueia tudo. Esse comportamento está correto, mas o painel deve mostrar esse motivo.
7. **A descoberta grava no banco.** `autoprovisionamento.tsx` (L61-134), ao coletar, faz insert/update em `onus` e grava histórico. Isso viola "não gravar dados" nesta etapa: a coleta deve ficar só em leitura até ser liberada.
8. **Formato de erro.** O agente responde com `Results.Problem` (`application/problem+json`, com `detail`). O cliente descarta o corpo e mostra só "HTTP 502/503". Falta usar `detail` (por exemplo: "consultas desabilitadas", "fingerprint não corresponde").

## Riscos de CORS e Private Network Access
- A lista padrão de origens do agente inclui o preview e dm4615.lovable.app, mas **não** a origem `*.lovableproject.com` do editor. Dentro do editor, as chamadas falham como "network".
- O preflight PNA só é aceito se a origem estiver na lista. O Chrome exige HTTPS na origem, o que vale para preview e publicado. Ele pode também pedir permissão de "rede local" (Chrome 142+), e o usuário precisa aceitar.
- O `fetch` não envia `targetAddressSpace: "loopback"`. Adicionar esse campo é opcional e melhora a compatibilidade.
- Mixed content: chamar `http://127.0.0.1` a partir de HTTPS é permitido para loopback no Chrome e no Edge. O Firefox e o Safari podem bloquear. Isso será documentado.

## Ajustes mínimos (só frontend, somente leitura)
- `src/lib/agent-api.ts`:
  - `PON_LIST` com 1/1/1 a 1/1/16.
  - `assertPon` valida o formato e o intervalo, em vez de um valor fixo.
  - Allowlist gerada por PON.
  - Tipos e validação de `parsed`, em formato tolerante: ONU {id, serial, state} e interface {admin, oper, …}. Se `parsed` vier inválido, cai para "sem dados estruturados", nunca para dados fictícios.
  - Leitura de `detail` nos erros.
  - Concorrência limitada a 2–4 chamadas ao varrer as 16 PONs.
- `src/routes/_authenticated/painel.tsx`:
  - Grade de 16 PONs com estado e contagem de ONUs vindos do agente.
  - Tabela de ONUs a partir de `parsed`.
  - Estados distintos: desconhecido, offline, sem token, capability ausente, comandos desabilitados, PON vazia e falha por PON.
  - Remover o uso de `olt-snapshot.ts`.
- `src/lib/olt-snapshot.ts`: remover, ou restringir a referência documental fora da UI.
- `src/routes/_authenticated/autoprovisionamento.tsx`: deixar a coleta somente em memória, com as gravações no banco desativadas por flag, e trocar o regex por `parsed`.
- `src/agent/Program.cs` e README: alinhar com o contrato real (16 PONs, `parsed`, origens incluindo lovableproject.com). Marcar `agent/app.py` como legado. Nada disso altera o agente instalado.
- Demo: continua isolado em `demo-data.ts`, sem mudanças.

## Auth e RLS
- `_authenticated/route.tsx` protege as telas com `getUser()`, e o Google já está configurado. Nenhuma mudança é necessária.
- O token do agente fica só no estado React; apenas a URL vai para o localStorage. Isso está correto.
- Leitura de RLS e policies: só por consulta, sem alterar nada. Nesta auditoria ela não foi verificada no banco.

## Validações
- Testes em `src/test/agent-api.test.ts`:
  - `PON 1/1/16` é aceita; `1/1/17` e `2/1/1` são bloqueadas sem fetch.
  - `parsed` da 1/1/2 gera 2 ONUs: ZTEGC4FFAB0A Up e ZYXE8CAF45DD Down.
  - `parsed` inválido não produz dados.
  - `detail` de um 503 aparece na mensagem.
  - Comandos fora do padrão são recusados.
  - Escrita continua bloqueada.
- Teste do painel: com o agente simulado online, ele renderiza 16 PONs e nenhum serial DEMO ou fixo. Sem agente, nenhum fetch acontece além de `/health`.
- Rodar vitest, typecheck e lint.
- Validação manual com o agente real no PC: `/health`, depois "Testar conexão", depois a varredura das 16 PONs, conferindo a 1/1/2 com 2 ONUs.

## Pendência antes de implementar
Preciso de um exemplo real (anonimizado) do JSON de `/olt/gpon/onu?pon=1/1/2` e de `/olt/gpon/interface?pon=1/1/2`, para tipar `parsed` exatamente.
