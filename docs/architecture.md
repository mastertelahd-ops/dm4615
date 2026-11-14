# Arquitetura proposta — DM4615

## Componentes

1. **Painel web**: interface React/TanStack, com acesso local e remoto.
2. **Agente Windows**: processo local responsável pela comunicação SSH com a OLT.
3. **VPN privada**: transporte de rede entre painel remoto e host Windows; fornecedor ainda a definir.
4. **OLT Datacom DM4615**: conexão SSHv2 TCP/22 pela interface MGMT.

## Fluxo pretendido

```text
Painel local ── loopback seguro ── Agente Windows ── SSH/MGMT ── DM4615
Painel remoto ── VPN privada ── HTTPS/TLS ── Agente Windows ── SSH/MGMT ── DM4615
```

## Estado de implementação

- API local atual restrita a 127.0.0.1:17861.
- Token local exigido nos endpoints protegidos.
- Teste SSH verifica fingerprint SHA-256 e não executa comandos.
- Scripts para publicação self-contained Windows x64 e definição de instalador Inno Setup adicionados.
- Acesso remoto via VPN ainda não habilitado. Não vincular a API a 0.0.0.0, não abrir portas públicas e não criar regras de encaminhamento.
- O fornecedor VPN e o IP privado do host Windows ainda precisam ser definidos.
- Serviço Windows automático depende de armazenamento seguro de segredos via DPAPI/Windows Credential Manager.

## Requisitos para habilitar acesso VPN

1. Confirmar o produto VPN e a interface/endereço privado atribuídos ao host Windows.
2. Vincular o listener remoto exclusivamente ao IP da interface VPN, validando que o IP pertence à interface esperada.
3. Exigir HTTPS/TLS com certificado confiável e autenticação forte do dispositivo.
4. Restringir firewall ao peer/sub-rede VPN autorizada.
5. Implementar rotação e revogação de credenciais e auditoria.
6. Manter o listener local separado do listener VPN.
7. Nunca encaminhar SSH/22 da OLT nem a API do agente para a internet pública.

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
