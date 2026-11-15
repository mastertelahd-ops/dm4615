# Agente Windows DM4615 — integração inicial

O agente expõe uma API local em `127.0.0.1:17861` e faz SSH para a OLT `192.168.0.25:22`. Não escuta em interfaces públicas.

## Requisitos

- Windows 10/11 x64
- .NET 8 SDK
- Acesso TCP da máquina Windows à OLT na porta SSH 22
- Usuário/senha SSH da OLT e fingerprint SHA-256 confirmada por canal confiável
- Token aleatório forte para proteger as rotas de consulta

## Configurar em PowerShell

Defina os valores somente na sessão local do PowerShell. Nunca os coloque no Git, no painel web, em prints ou no chat:

```powershell
$env:DM4615_SSH_HOST = "192.168.0.25"
$env:DM4615_SSH_PORT = "22"
$env:DM4615_SSH_USERNAME = "SEU_USUARIO"
$env:DM4615_SSH_PASSWORD = "SUA_SENHA"
$env:DM4615_SSH_HOSTKEY_SHA256 = "FINGERPRINT_SHA256_CONFIRMADA"
$env:DM4615_AGENT_TOKEN = "TOKEN_ALEATORIO_FORTE"
$env:DM4615_AGENT_ALLOWED_ORIGINS = "https://dm4615.lovable.app;https://id-preview--5048035b-5812-5d98-a874-ee5a764cc22d.lovable.app"
```

Por segurança, comandos de leitura iniciam desabilitados. Primeiro execute o agente e teste o handshake SSH; depois valide as consultas manualmente no equipamento e só então habilite:

```powershell
$env:DM4615_ENABLE_READ_COMMANDS = "true"
```

## Executar

Na raiz do repositório:

```powershell
dotnet restore .\src\agent\Dm4615.Agent.csproj
dotnet run --project .\src\agent\Dm4615.Agent.csproj
```

## API

- `GET /health`: status público, versão e capabilities disponíveis.
- `GET /olt/gpon/interface?pon=1/1/2`: somente leitura; executa `show interface gpon 1/1/2`.
- `GET /olt/gpon/onu?pon=1/1/2`: somente leitura; executa `show interface gpon 1/1/2 onu`.
- `POST /olt/cli/read`: permite somente esses dois comandos exatos.

Rotas protegidas aceitam `Authorization: Bearer <token>`. A API inclui CORS e Private Network Access para as origens listadas em `DM4615_AGENT_ALLOWED_ORIGINS`. Não use curingas.

Apenas a PON 1/1/2 foi validada até agora. As demais portas são rejeitadas. `show onu` isolado não é um comando válido nesse firmware. Nenhum comando de configuração, provisionamento, reboot ou limpeza é aceito.

## Limitações importantes

- As consultas usam SSH exec via SSH.NET. É necessário validar no equipamento se o firmware permite esse canal; se a OLT exigir shell interativo/paginador, o adaptador deverá ser ajustado antes de ativar comandos.
- O painel usa as capabilities retornadas por `/health` e não chama endpoints que não estejam anunciados.
- Não há leitura de potência RX/TX por ONU, distância ou tráfego individual nesta entrega.
- Não instalar como serviço automático até implementar armazenamento seguro de credenciais com DPAPI/Windows Credential Manager.
- Não expor API com Tailscale Serve/Funnel nem abrir portas públicas. Acesso remoto exige autenticação de identidade e autorização adicionais.
