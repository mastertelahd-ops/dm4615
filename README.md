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

## Modo demonstração
Ativado no menu lateral. Exibe somente dados fictícios marcados "SIMULAÇÃO — NÃO SÃO DADOS DA OLT" e não chama o agente.

## Atualização automática
Opcional a cada 30 s na tela GPON/ONUs; pausa quando a aba fica inativa.

## Agente Windows — integração GPON de leitura

O agente .NET 8 está em `src/agent`. Ele escuta somente em `127.0.0.1:17861`, valida token Bearer e fingerprint SSH SHA-256 fixada, e permite consultas somente de leitura à PON `1/1/2`.

Consulte [src/agent/README.md](src/agent/README.md) para configuração local. Credenciais devem permanecer em variáveis de ambiente no Windows; nunca as grave no Git. As consultas CLI só são anunciadas quando `DM4615_ENABLE_READ_COMMANDS=true`. Escrita, provisionamento e reboot permanecem bloqueados.

O agente libera `/health` e a resposta vazia `/favicon.ico` sem autenticação; todas as rotas operacionais exigem token. A origem CORS deve estar na allowlist exata. Não exponha o serviço fora do loopback.
