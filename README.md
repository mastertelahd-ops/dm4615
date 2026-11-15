# DM4615 — Painel de OLT (somente leitura)

Painel web para a OLT Datacom DM4615 (192.168.0.25) que conversa com um **agente local Windows**. O navegador nunca recebe senha SSH: quem acessa a OLT é o agente.

## Conectar o agente
1. Instale e rode o agente na mesma máquina (padrão `http://127.0.0.1:17861`).
2. No painel, abra **Conexão do agente**, confira a URL e informe o token do agente.
   - A URL pode ser salva no navegador; o **token fica só em memória** (não vai para localStorage, URL, logs ou banco).
3. Clique em **Testar conexão** (`GET /health`).

O agente deve responder CORS para a origem do painel (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization, Content-Type`) e, para Chrome, `Access-Control-Allow-Private-Network: true` no preflight.

## Contrato que o agente precisa implementar
Todas as rotas exceto `/health` recebem `Authorization: Bearer <token>`.

| Rota | Capability | Comando na OLT |
|---|---|---|
| `GET /health` (público, sem token) → `{ status, version?, agent?, capabilities: string[] }` | — | — |
| `POST /olt/connection-test` (token) | — | handshake SSH (não habilita CLI) |
| `GET /olt/gpon/interface?pon=1/1/N` (N = 1..16) | `gpon.interface.read` | `show interface gpon 1/1/N` |
| `GET /olt/gpon/onu?pon=1/1/N` (N = 1..16) | `gpon.onu.read` | `show interface gpon 1/1/N onu` |
| `POST /olt/cli/read` body `{ command }` | `cli.read` | apenas allowlist de leitura |

Resposta das consultas: `{ command, collectedAt (ISO), raw, parsed? }`.
O painel só chama uma rota se `/health` listar a capability; caso contrário mostra "consulta não implementada". Obs.: `show onu` sozinho não existe no DM4615.

## Bloqueios e dados
Escrita, provisionamento, configuração e reboot na OLT estão bloqueados nesta versão. O projeto usa o banco Lovable Cloud existente para cadastros e fila administrativa; a descoberta GPON descrita abaixo é somente leitura e não grava nem atualiza tabelas.

## Desenvolvimento
```sh
bun install && bun run dev
bun run test && bun run lint && bun run build
```

## Modo demonstração
Ativado no menu lateral. Exibe somente dados fictícios marcados "SIMULAÇÃO — NÃO SÃO DADOS DA OLT" e não chama o agente.

## Atualização
A varredura geral das 16 PONs é manual e iniciada pelo usuário. As consultas detalhadas de interface, ONUs e terminal também são acionadas por clique; não há coleta automática em segundo plano.

## Agente Windows — integração GPON de leitura

O agente .NET 8 está em `src/agent`. Ele escuta somente em `127.0.0.1:17861`, valida token Bearer e fingerprint SSH SHA-256 fixada, e permite consultas somente de leitura às PONs `1/1/1` a `1/1/16`.

Consulte [src/agent/README.md](src/agent/README.md) para configuração local. Credenciais devem permanecer em variáveis de ambiente no Windows; nunca as grave no Git. As consultas CLI só são anunciadas quando `DM4615_ENABLE_READ_COMMANDS=true`. Escrita, provisionamento e reboot permanecem bloqueados.

O agente libera `/health` e a resposta vazia `/favicon.ico` sem autenticação; todas as rotas operacionais exigem token. A origem CORS deve estar na allowlist exata. Não exponha o serviço fora do loopback.

## Integração com o agente Windows (16 PONs)
- O painel consulta manualmente 1/1/1 a 1/1/16 somente quando o usuário clica em “Consultar 16 PONs” ou “Buscar agora”. A concorrência máxima é 4 PONs por vez. Para cada porta, consulta interface e lista de ONUs e usa `parsed` do agente. Não há varredura automática nem gravação durante a descoberta.
- Origens CORS que o agente deve permitir: preview, publicado e `https://5048035b-5812-5d98-a874-ee5a764cc22d.lovableproject.com` (editor). O agente precisa responder `Access-Control-Allow-Private-Network: true`. No Chrome e no Edge, aceite o pedido de "acesso à rede local". Firefox e Safari podem bloquear chamadas a `http://127.0.0.1` a partir de HTTPS.
- Erros `problem+json` do agente (`detail`) são exibidos ao usuário.
- A descoberta em Autoprovisionamento também é manual e **somente leitura**: consulta as 16 PONs, mantém os resultados em memória e não executa `insert`, `update` ou `upsert` durante a coleta. As ações de solicitação/aprovação são fluxos administrativos separados e não executam comandos na OLT.
- `agent/app.py` é legado: o contrato atual é o agente .NET em `src/agent/`.
