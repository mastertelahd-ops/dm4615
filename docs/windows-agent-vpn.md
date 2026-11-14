# Distribuição Windows e acesso por VPN — DM4615

## Decisões confirmadas
- Painel utilizável local e remotamente.
- VPN recomendada: **Tailscale**.
- Entrega em executável portátil e instalador Windows.
- Agente acessa a OLT por SSH na rede MGMT; não expor SSH/22 à internet.
- Banco, migrations e dados do painel permanecem fora do escopo.

## Por que Tailscale
Tailscale cria uma rede privada entre os dispositivos autorizados, sem exigir encaminhamento de portas no roteador. O recurso Tailscale Serve pode fornecer HTTPS para serviços acessíveis somente no tailnet, aplicando as regras de acesso do próprio tailnet. Consulte a documentação oficial:
- https://tailscale.com/docs/features/tailscale-serve
- https://tailscale.com/docs/features/access-control
- https://tailscale.com/docs/features/access-control/grants

Para este projeto, usar grants com privilégio mínimo e incluir somente os computadores/usuários autorizados.

## Estado real desta entrega
A base atual do agente .NET 8 oferece API HTTP somente em loopback (127.0.0.1:17861), token local e teste de handshake SSH com fingerprint SHA-256 fixada. O teste não executa comandos CLI.

Foi adicionado o script de diagnóstico `scripts/test-tailscale.ps1`. Ele apenas consulta `tailscale status --json`, mostra o nome DNS privado, estado online e IPs Tailscale. Não instala, autentica, configura ou altera o cliente VPN.

**A conexão remota do painel ainda NÃO está habilitada.** Não execute `tailscale serve` apontando para a API do agente nesta etapa. A API exige um token compartilhado, e a integração de identidade/autorização de usuários do painel ainda não foi implementada. Expor a API apenas com esse token não atende ao modelo final de segurança.

A etapa seguinte deve implementar autenticação de usuário/dispositivo, autorização por perfil e auditoria no agente, usando identidade validada pelo Tailscale Serve ou um canal de saída autenticado. Somente depois disso poderá ser habilitado o proxy HTTPS privado.

## Preparar Tailscale no Windows (manual, sem alteração automática)
1. Instale o cliente oficial: https://tailscale.com/download/windows
2. Entre com a conta que será administradora do tailnet.
3. Instale o Tailscale nos computadores que terão acesso remoto.
4. No console administrativo, habilite MagicDNS e HTTPS certificates se necessário.
5. Configure grants para permitir acesso apenas aos usuários/dispositivos autorizados. Não mantenha uma regra ampla para todos se não for necessária.
6. Não habilite Funnel. Funnel publica serviços na internet; para este caso, somente Serve privado poderá ser considerado após a autenticação da aplicação estar pronta.

Para verificar o Windows do agente, abra PowerShell na raiz do repositório:

```powershell
.\scripts\test-tailscale.ps1
```

O script é somente leitura. Ele informa se o dispositivo está online e mostra seu IP privado Tailscale. Código de saída 2 significa cliente ausente; 3 significa dispositivo offline.

## Publicação dos artefatos
Requisitos:
- Windows 10/11 x64.
- .NET 8 SDK.
- Inno Setup 6 apenas para compilar o instalador.

Executável portátil:

```powershell
.\scripts\publish-agent-windows.ps1
```

Instalador:

```powershell
.\scripts\publish-agent-windows.ps1 -BuildInstaller
```

Saídas:
- `artifacts/win-x64/Dm4615.Agent.exe` — executável portátil self-contained.
- `artifacts/installer/FireNet-DM4615-Agent-Setup.exe` — instalador Inno Setup.

Os artefatos são gerados localmente e não são enviados ao Git. Não há binário compilado ou assinado nesta alteração do repositório.

## Topologia pretendida
```text
Painel remoto ── Tailscale tailnet ── HTTPS privado (futuro)
                                      │
                                      Agente Windows ── SSH/MGMT ── DM4615
Painel local ── acesso local ─────────┘
```

Regras:
1. Não criar port-forward público para a OLT, SSH/22 ou API do agente.
2. Não usar `0.0.0.0` como endereço de escuta.
3. A API atual permanece em `127.0.0.1:17861`.
4. Antes de habilitar Serve, implementar autenticação de identidade Tailscale no agente e autorização por usuário/dispositivo.
5. Restringir grants aos usuários e dispositivos necessários.
6. Não usar Funnel nem expor a API diretamente à internet.
7. Segredos e certificados ficam no Windows (DPAPI/Windows Credential Manager), nunca no Git, navegador ou arquivo de configuração versionado.

## Serviço Windows
O projeto já usa o host genérico do .NET com integração Windows Service, mas a instalação como serviço e a inicialização automática só devem ser ativadas depois que credenciais SSH, token e certificados forem armazenados com proteção DPAPI/Windows Credential Manager. Até lá, executar em modo controlado e não instalar serviço com segredos em variáveis de máquina.

## Segurança e escopo
- Nenhum comando de configuração da OLT está habilitado.
- Nenhuma credencial/fingerprint real deve ser versionada.
- Nenhuma migration, tabela ou dado de banco foi alterado.
- Nenhum deploy/publicação, instalação automática, configuração VPN ou alteração de firewall foi realizado.
- O instalador não configura VPN nem modifica firewall.
