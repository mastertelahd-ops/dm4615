# Agente local Windows — DM4615

Fundação inicial do agente. O projeto não altera banco de dados e não executa comandos de configuração na OLT.

## Configuração

- .NET 8 SDK.
- IP MGMT padrão documentado: `192.168.0.25` (confirme se esse é realmente o IP da OLT).
- SSH TCP/22.
- Credenciais e fingerprint devem ser configurados somente no ambiente Windows.

Defina as variáveis no PowerShell antes de iniciar:

```powershell
$env:DM4615_SSH_HOST = "192.168.0.25"
$env:DM4615_SSH_PORT = "22"
$env:DM4615_SSH_USERNAME = "SEU_USUARIO"
$env:DM4615_SSH_PASSWORD = "SUA_SENHA"
$env:DM4615_SSH_HOSTKEY_SHA256 = "FINGERPRINT_SHA256_DO_PUTTY"
$env:DM4615_AGENT_TOKEN = "GERE_UM_TOKEN_ALEATORIO_FORTE"
```

Não salve valores reais em arquivos versionados, prints, tickets ou logs. A configuração definitiva deverá migrar para Windows Credential Manager/DPAPI.

## Executar

```powershell
dotnet restore .\src\agent\Dm4615.Agent.csproj
dotnet run --project .\src\agent\Dm4615.Agent.csproj
```

O agente escuta em `http://127.0.0.1:17861` apenas. Requisições exigem `X-Agent-Token`.

Teste:

```powershell
Invoke-RestMethod http://127.0.0.1:17861/health -Headers @{ "X-Agent-Token" = $env:DM4615_AGENT_TOKEN }
Invoke-RestMethod -Method Post http://127.0.0.1:17861/olt/connection-test -Headers @{ "X-Agent-Token" = $env:DM4615_AGENT_TOKEN }
```

O endpoint de teste faz apenas o handshake SSH. Nenhum comando CLI é enviado. A host key precisa corresponder ao fingerprint SHA-256 configurado; sem fingerprint, a conexão é recusada.

## Próxima validação necessária

No PuTTY, execute `?` e `show ?` (somente se o primeiro comando indicar suporte) e compartilhe a saída sem senhas. Isso permite mapear a CLI real do firmware antes de implementar operações de leitura/escrita.
