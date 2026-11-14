# DM4615 — Gestão de OLT

Painel web e agente local Windows para gerenciamento de OLT Datacom DM4615 por SSH na porta MGMT.

## Estado atual

- Interface web existente preservada.
- Novo agente Windows em `src/agent` (fundação inicial).
- O agente escuta somente em loopback (`127.0.0.1`) e não expõe SSH da OLT à internet.
- O teste inicial valida apenas a conexão SSH; não executa comandos de configuração.
- Nenhuma tabela, migration, credencial ou dado do banco foi alterado.

## Preferências aprovadas

- Painel: local e remoto.
- Agente: instalação local no Windows.
- Objetivo: gerenciamento completo, implementado com ativação progressiva e controles de segurança.

## Iniciar o agente (Windows)

Requisitos: .NET 8 SDK.

1. Copie `src/agent/appsettings.sample.json` para `appsettings.json` e ajuste o IP MGMT.
2. Defina as variáveis de ambiente descritas em `src/agent/README.md`.
3. Execute:

```powershell
dotnet restore .\src\agent\Dm4615.Agent.csproj
dotnet run --project .\src\agent\Dm4615.Agent.csproj
```

O agente responde em `http://127.0.0.1:17861`. A API exige o cabeçalho `X-Agent-Token`.

> Não publique nem instale em produção ainda. O protocolo CLI, os comandos suportados e a impressão digital SSH do equipamento precisam ser validados com a saída do PuTTY.

## Arquitetura e segurança

Consulte [docs/architecture.md](docs/architecture.md) e [src/agent/README.md](src/agent/README.md).
