# Arquitetura proposta — DM4615

## Componentes

1. **Painel web**: interface React/TanStack, com acesso local e remoto.
2. **Agente Windows**: processo local responsável pela comunicação SSH com a OLT.
3. **Tailscale**: VPN mesh privada entre os dispositivos autorizados.
4. **OLT Datacom DM4615**: conexão SSHv2 TCP/22 pela interface MGMT.

## Fluxo pretendido

```text
Painel remoto ── Tailscale tailnet ── HTTPS privado (Tailscale Serve, futuro)
                                         │
                                         Agente Windows ── SSH/MGMT ── DM4615
Painel local ── acesso local ────────────┘
```

## Estado de implementação

- API local atual restrita a 127.0.0.1:17861.
- Token local exigido nos endpoints protegidos.
- Teste SSH verifica fingerprint SHA-256 e não executa comandos.
- Scripts para publicação self-contained Windows x64 e definição de instalador Inno Setup adicionados.
- Script de diagnóstico Tailscale somente leitura adicionado em scripts/test-tailscale.ps1.
- Tailscale Serve não está habilitado. Não executar Serve para a API do agente até implementar autenticação de identidade e autorização no próprio agente.
- Não vincular a API a 0.0.0.0, não abrir portas públicas e não criar regras de encaminhamento.
- Serviço Windows automático depende de armazenamento seguro de segredos via DPAPI/Windows Credential Manager.

## Requisitos para habilitar acesso remoto

1. Instalar e autenticar o Tailscale nos dispositivos autorizados.
2. Habilitar MagicDNS e certificados HTTPS no tailnet, se ainda não estiverem ativos.
3. Configurar grants com privilégio mínimo para usuários/dispositivos autorizados.
4. Implementar autenticação de identidade Tailscale e autorização por usuário/dispositivo no agente.
5. Habilitar Tailscale Serve somente depois de validar a identidade e impedir acesso direto não autenticado à API.
6. Implementar auditoria, rotação e revogação de credenciais.
7. Nunca encaminhar SSH/22 da OLT nem a API do agente para a internet pública. Não usar Tailscale Funnel.

## Escopo de gerenciamento

- Inventário, versão, estado do sistema e alarmes.
- Interfaces PON, ONUs, potência óptica, estado e contadores.
- Provisionamento e alteração de parâmetros, somente em fase posterior com autorização explícita.

As consultas serão mapeadas a partir da CLI/documentação oficial do firmware instalado. Não presumir sintaxe de outros modelos Datacom.

## Barreiras obrigatórias

- SSH com verificação estrita de host key (fingerprint SHA-256 fixado).
- Segredos fora do Git; nunca registrar senha, token ou conteúdo sensível.
- API local vinculada exclusivamente a 127.0.0.1.
- Lista explícita de comandos permitidos, parâmetros validados e bloqueio por padrão.
- Operações de escrita desabilitadas até validação do comando, autorização RBAC, confirmação explícita, auditoria e plano de rollback.
- Timeout, limite de saída e cancelamento de comandos.
- Nenhuma credencial SSH enviada ao navegador.

## Preservação e implantação

- Não alterar schema, migrations, tabelas, dados, variáveis ou integração de banco.
- O agente inicial é independente do banco.
- Não publicar, implantar, instalar automaticamente nem mesclar PR nesta etapa.
- Desenvolver na branch feat/dm4615-windows-agent e revisar antes de mesclar.
