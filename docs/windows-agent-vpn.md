# Distribuição Windows e acesso por VPN — DM4615

## Decisões confirmadas
- Painel utilizável na rede local e remotamente.
- Acesso remoto entre painel e agente por VPN privada.
- Entrega em dois formatos: executável portátil e instalador Windows.
- O agente acessa a OLT por SSH na rede MGMT; não expor SSH/22 à internet.
- Banco, migrations e dados do painel permanecem fora do escopo.

## Estado real desta entrega
A base atual do agente .NET 8 oferece API HTTP somente em loopback (127.0.0.1:17861), token local e teste de handshake SSH com fingerprint SHA-256 fixada. O teste não executa comandos CLI.

O pacote portátil e o instalador empacotam essa base. O acesso remoto pela VPN ainda NÃO está habilitado: não se deve alterar a API para escutar em todas as interfaces nem encaminhar a porta 17861 no roteador. A próxima etapa precisa vincular a API somente ao endereço da interface VPN, exigir HTTPS com certificado confiável e autenticação forte do dispositivo, além de validar que o endereço pertence à interface VPN esperada.

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
- artifacts/win-x64/Dm4615.Agent.exe — executável portátil self-contained.
- artifacts/installer/FireNet-DM4615-Agent-Setup.exe — instalador Inno Setup.

Os artefatos são gerados localmente e não são enviados ao Git. Não há binário compilado ou assinado nesta alteração do repositório.

## VPN — topologia esperada
```text
Painel remoto ── VPN privada ── Agente Windows ── SSH/MGMT ── DM4615
Painel local  ──────────────── Agente Windows ── SSH/MGMT ── DM4615
```

Regras:
1. VPN deve fornecer conectividade privada entre o computador do painel e o host Windows do agente.
2. Não criar port-forward público para a OLT, SSH/22 ou API do agente.
3. Não usar 0.0.0.0 como endereço de escuta.
4. O listener VPN futuro deve aceitar apenas um IP VPN explicitamente configurado, nunca qualquer interface.
5. Listener remoto deve usar HTTPS/TLS e autenticação por dispositivo; token isolado em HTTP não é suficiente.
6. Restringir firewall ao endereço/sub-rede VPN necessária.
7. Revogar credenciais do agente quando um dispositivo for removido.
8. Segredos e certificados ficam no Windows (DPAPI/Windows Credential Manager), nunca no Git, navegador ou arquivo de configuração versionado.

## Informação necessária para concluir a integração VPN
Precisamos escolher o software/tipo de VPN já usado ou desejado na rede (por exemplo, WireGuard, Tailscale ou OpenVPN) e conhecer o IP privado VPN do computador Windows. Não assumir um fornecedor nem abrir portas automaticamente.

## Serviço Windows
O projeto já usa o host genérico do .NET com integração Windows Service, mas a instalação como serviço e a inicialização automática só devem ser ativadas depois que credenciais SSH, token e certificado forem armazenados com proteção DPAPI/Windows Credential Manager. Até lá, executar em modo controlado e não instalar serviço com segredos em variáveis de máquina.

## Segurança e escopo
- Nenhum comando de configuração da OLT está habilitado.
- Nenhuma credencial/fingerprint real deve ser versionada.
- Não houve alteração de banco, migrations, publicação ou instalação automática.
- O instalador não configura VPN nem modifica firewall/roteador.
