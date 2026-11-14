# Agente local Windows — DM4615

Fundação inicial do agente .NET 8. O projeto não altera banco de dados e não executa comandos de configuração na OLT.

## Configuração

- Windows 10/11 x64.
- .NET 8 SDK para execução a partir do código.
- IP MGMT padrão documentado: 192.168.0.25 (confirme se esse é realmente o IP da OLT).
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

## Executar pelo código

```powershell
dotnet restore .\src\agent\Dm4615.Agent.csproj
dotnet run --project .\src\agent\Dm4615.Agent.csproj
```

A API escuta em http://127.0.0.1:17861. Os endpoints protegidos exigem X-Agent-Token. O health básico é público e não retorna dados sensíveis.

## Empacotar para Windows

Na raiz do repositório:

```powershell
.\scripts\publish-agent-windows.ps1
```

Gera o executável portátil self-contained em artifacts/win-x64.

Para gerar também o instalador, instale Inno Setup 6 e execute:

```powershell
.\scripts\publish-agent-windows.ps1 -BuildInstaller
```

O instalador é uma embalagem inicial do agente e da documentação; não configura VPN, não abre firewall e não instala serviço automático. O modo serviço será concluído após implementar armazenamento de segredos com DPAPI/Windows Credential Manager.

Consulte docs/windows-agent-vpn.md para limitações e requisitos de VPN. Os artefatos binários são gerados localmente e não devem ser versionados.

## Testes da API local

```powershell
Invoke-RestMethod http://127.0.0.1:17861/health
Invoke-RestMethod -Method Post http://127.0.0.1:17861/olt/connection-test -Headers @{ "X-Agent-Token" = $env:DM4615_AGENT_TOKEN }
```

O endpoint de teste faz apenas o handshake SSH. Nenhum comando CLI é enviado. A host key precisa corresponder ao fingerprint SHA-256 configurado; sem fingerprint, a conexão é recusada.

## Validação da CLI

As consultas reais compartilhadas pelo operador estão em docs/device-cli-validation.md. O agente ainda não executa comandos de leitura: o adaptador CLI depende de tratamento correto do paginador --More--, do prompt e dos limites de saída.

Nenhuma operação de configuração, limpeza ou reboot será liberada nesta etapa.
