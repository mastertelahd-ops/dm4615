# Arquitetura proposta — DM4615

## Componentes

1. **Painel web**: interface atual React/TanStack. Acesso local e remoto.
2. **Agente Windows local**: processo/serviço instalado no computador da rede de gerência.
3. **OLT Datacom DM4615**: conexão SSHv2 TCP/22 pela interface MGMT.
4. **Canal remoto futuro**: conexão de saída HTTPS/WSS iniciada pelo agente para um backend autenticado. Não abrir portas de entrada no roteador nem publicar a porta SSH.

## Fluxo

```text
Painel local ── HTTPS/localhost ──┐
                                  ├── Agente Windows ── SSHv2/MGMT ── DM4615
Painel remoto ── HTTPS/WSS ── API ─┘
                         (canal de saída do agente)
```

A ponte remota ainda não está implementada. Ela exige autenticação de dispositivo, associação do agente a uma conta/OLT, TLS, rotação/revogação de credenciais e autorização por função.

## Escopo de gerenciamento completo

- Inventário, versão, estado do sistema e alarmes.
- Interfaces PON, ONUs, potência óptica, estado e contadores.
- Provisionamento e alteração de parâmetros.
- Reinicialização e operações de impacto.

As consultas e operações serão mapeadas a partir da CLI/documentação oficial do firmware instalado. Não presumir sintaxe de comandos com base em outros modelos Datacom.

## Barreiras obrigatórias

- SSH com verificação estrita de host key (fingerprint SHA-256 fixado).
- Segredos fora do Git; nunca registrar senha, token ou conteúdo sensível.
- API local vinculada exclusivamente a 127.0.0.1 e protegida por token.
- Lista explícita de comandos permitidos, parâmetros validados e bloqueio por padrão.
- Operações de escrita desabilitadas até validação do comando, autorização RBAC, confirmação explícita, auditoria e plano de rollback.
- Timeout, limite de saída e cancelamento de comandos.
- Auditoria com usuário, ação, alvo, horário, resultado e identificador de correlação.
- Nenhuma credencial SSH enviada ao navegador.

## Preservação do projeto

- Não alterar schema, migrations, tabelas, dados, variáveis ou integração de banco existente.
- O agente inicial é independente do banco.
- Não publicar, implantar ou instalar automaticamente.
- Desenvolver em branch separada e revisar antes de abrir/mesclar PR.

## Etapas de validação

1. Confirmar IP MGMT, rota e porta TCP/22.
2. Obter fingerprint SSH e validar a política de host key.
3. Fazer handshake SSH sem executar comando.
4. Capturar no PuTTY a saída de ajuda e comandos de leitura suportados.
5. Implementar adaptador CLI específico para firmware e testar apenas leitura.
6. Integrar painel local.
7. Implementar canal remoto WSS com autenticação mútua de dispositivo.
8. Liberar comandos de escrita por grupos, cada um com autorização, confirmação, auditoria e rollback.
