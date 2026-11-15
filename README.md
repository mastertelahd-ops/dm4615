# DM4615 — Painel de OLT (somente leitura)

Painel web para a OLT Datacom DM4615 (192.168.0.25) que conversa com um **agente local Windows**. O navegador nunca recebe senha SSH: quem acessa a OLT é o agente.

## Conectar o agente
1. Instale e rode o agente na mesma máquina (padrão `http://127.0.0.1:17861`).
2. No painel, abra **Conexão do agente**, confira a URL e informe o token do agente.
   - A URL pode ser salva no navegador; o **token fica só em memória** (não vai para localStorage, URL, logs ou banco).
3. Clique em **Testar conexão** (`GET /health`).

O agente deve responder CORS para a origem do painel (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization, Content-Type`) e, para Chrome, `Access-Control-Allow-Private-Network: true` no preflight.

## Contrato que o agente precisa implementar
Todas as rotas recebem `Authorization: Bearer <token>`.

| Rota | Capability | Comando na OLT |
|---|---|---|
| `GET /health` → `{ status, version?, agent?, capabilities: string[] }` | — | — |
| `GET /olt/gpon/interface?pon=1/1/2` | `gpon.interface.read` | `show interface gpon 1/1/2` |
| `GET /olt/gpon/onu?pon=1/1/2` | `gpon.onu.read` | `show interface gpon 1/1/2 onu` |
| `POST /olt/cli/read` body `{ command }` | `cli.read` | apenas allowlist de leitura |

Resposta das consultas: `{ command, collectedAt (ISO), raw, parsed? }`.
O painel só chama uma rota se `/health` listar a capability; caso contrário mostra "consulta não implementada". Obs.: `show onu` sozinho não existe no DM4615.

## Bloqueios
Escrita, provisionamento, configuração e reboot estão bloqueados nesta versão. Não há banco de dados.

## Desenvolvimento
```sh
bun install && bun run dev
bun run test && bun run lint && bun run build
```


## Agente Windows — integração de leitura

A branch `feat/dm4615-live-agent` inclui a API local .NET 8 para teste de SSH e consultas de leitura da PON `1/1/2`. O serviço permanece em loopback e exige fingerprint SSH SHA-256 fixada. As consultas CLI começam desabilitadas e só são anunciadas em `/health` quando `DM4615_ENABLE_READ_COMMANDS=true`.

Leia [src/agent/README.md](src/agent/README.md) antes de configurar. Não grave credenciais no repositório e não exponha a API publicamente. O agente ainda precisa ser compilado e testado no Windows contra a OLT real; a implementação usa SSH exec e pode exigir adaptação para shell interativo se o firmware não aceitar exec.
