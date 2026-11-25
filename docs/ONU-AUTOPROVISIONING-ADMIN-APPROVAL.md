# DM4615 — Plano técnico de autoprovisionamento com aprovação

## Objetivo

Implementar descoberta de ONUs, associação com cliente/plano e preparação de provisionamento, exigindo aprovação explícita de um administrador antes de qualquer comando de escrita na OLT.

Esta especificação não habilita escrita na OLT. O agente atual continua somente leitura até que os comandos do firmware DM4615 sejam validados em laboratório.

## Fluxo funcional

1. O coletor consulta as PONs habilitadas e recebe serial, ONU ID, estado e PON de cada ONU.
2. Normaliza o serial (maiúsculas, sem espaços) e usa-o como identificador estável da ONU.
3. Compara a descoberta com o inventário persistente:
   - serial desconhecido: criar evento discovered e uma solicitação pendente;
   - serial conhecido na mesma PON: atualizar estado e horário da coleta;
   - serial conhecido em outra PON: criar evento pon_changed, sem mover/provisionar automaticamente;
   - serial duplicado na mesma coleta: colocar em quarentena e não propor escrita.
4. Procura vínculo por serial com ONU, cliente e plano. Se não houver correspondência única, exige associação manual pelo administrador.
5. Administrador seleciona PON de destino, perfil bridge ou router, VLAN/serviço e perfil de velocidade a partir de modelos previamente validados.
6. O servidor cria um plano imutável (provisioning_request) com diff/comandos previstos, solicitante, origem, ONU, cliente, plano e validade.
7. Administrador autenticado revisa o diff e aprova ou rejeita. A aprovação deve ser uma ação explícita, protegida por autorização de servidor e confirmação adicional.
8. Só após aprovação válida, o executor envia os comandos permitidos ao agente. O executor usa chave de idempotência, trava por serial/PON e bloqueia repetição concorrente.
9. O agente executa a sequência validada, captura cada resposta e interrompe em erro. Nunca executa comandos arbitrários recebidos do navegador.
10. O verificador consulta novamente a ONU e confirma Up na PON esperada. Resultado final: succeeded, failed ou verification_pending; não declarar sucesso apenas porque SSH aceitou os comandos.

## Estados da solicitação

detected → needs_association → ready_for_review → approved → executing → verifying → succeeded.

Saídas alternativas: rejected, failed, expired, verification_pending, quarantined.

Mudança de PON não é uma operação física remota: o sistema detecta a nova porta após a fibra ser conectada nela e prepara a proposta. O sistema não pode transferir fisicamente a fibra.

## Modelo de dados proposto

- olt_devices: equipamento, endereço de gerenciamento, modelo, firmware e estado.
- pon_ports: porta GPON, estado administrativo/operacional e habilitação para coleta.
- onus: serial normalizado único, ONU ID, PON atual, estado, última coleta e modelo.
- customers: cadastro mínimo necessário do assinante.
- service_plans: plano, velocidade, VLAN e modelo de serviço.
- customer_services: vínculo cliente/plano/ONU, estado e datas.
- onu_profiles: modelos versionados bridge e router, parâmetros permitidos e compatibilidade de ONU.
- onu_observations: histórico imutável de observações coletadas.
- provisioning_requests: proposta, destino, perfil, diff, estado, solicitante, aprovador, expiração e chave de idempotência.
- provisioning_steps: passos versionados, saída sanitizada e resultado.
- audit_events: ator, ação, recurso, horário, IP/origem e resultado.

Restrições: serial normalizado único por OLT; uma solicitação ativa por serial; cliente/plano devem ter associação inequívoca; transições de estado validadas no servidor. Não armazenar senhas SSH ou tokens do agente nestas tabelas.

## Autenticação e administrador inicial

O painel atual não possui backend de autenticação nem banco integrado no repositório. Portanto, não implementar login fictício apenas no React ou em localStorage.

O administrador inicial será provisionado por configuração segura de ambiente:
- DM4615_ADMIN_USERNAME=rodrigo
- DM4615_ADMIN_PASSWORD_HASH=<hash Argon2id gerado localmente>
- DM4615_SESSION_SECRET=<segredo aleatório forte>

A senha inicial fornecida em conversa não deve ser gravada no Git, em código, migration, log ou documentação. Como foi compartilhada em texto, deve ser considerada exposta e substituída antes de ativar a conta. O bootstrap deve exigir troca de senha no primeiro login. Armazenar apenas hash Argon2id com salt; sessão em cookie HttpOnly, Secure, SameSite, com expiração e revogação. Rate limit, bloqueio temporário e trilha de auditoria são obrigatórios. Autorização de aprovação deve ser verificada no servidor; esconder botões no frontend não é controle de acesso.

## Contratos de API propostos

- GET /api/onus/observations: observações recentes coletadas.
- GET /api/onus: inventário com vínculo de cliente/plano.
- POST /api/provisioning/requests: criar proposta; não executa escrita.
- POST /api/provisioning/requests/:id/approve: aprovar com sessão admin válida e confirmação do diff/hash.
- POST /api/provisioning/requests/:id/reject: rejeitar com motivo.
- POST /api/provisioning/requests/:id/execute: endpoint interno, não acessível diretamente ao usuário comum; exige estado aprovado e autorização do executor.
- GET /api/provisioning/requests/:id: estado, passos e verificação.

Toda rota de mutação valida usuário, papel, CSRF, origem, estado e idempotência no servidor.

## Bridge e Router

Os perfis são templates versionados, não comandos livres:
- Bridge: parâmetros de porta/serviço, VLAN e mapeamento L2, conforme firmware e modelo de ONU.
- Router: WAN, modo de endereçamento, NAT, VLAN e parâmetros de LAN/Wi-Fi somente quando suportados pela ONU.

Não inferir nem preencher VLAN, credenciais PPPoE, IP, senha Wi-Fi ou parâmetros do cliente. Dados ausentes bloqueiam a proposta e pedem revisão. Compatibilidade por modelo/firmware é obrigatória.

## Mudança de PON

Quando o mesmo serial for visto em uma PON diferente:
- manter a PON cadastrada até aprovação;
- mostrar PON antiga e nova, horário e evidência da coleta;
- validar que não há serviço ativo conflitante;
- preparar solicitação de migração lógica;
- após aprovação, aplicar somente a sequência validada e confirmar Up na nova PON.

A mudança física depende do técnico conectar a fibra na nova porta.

## Segurança operacional e rollout

Fase A — leitura: ampliar descoberta de PONs e coletar serial/estado; validar sintaxe de cada comando com saída real do DM4615 e firmware. Nenhuma escrita.

Fase B — cadastro: persistência, associação cliente/plano, perfis e fila de aprovação. Executor permanece desabilitado.

Fase C — laboratório: validar comandos de provisionamento/desprovisionamento em ONU de teste isolada, capturar pré-condições, rollback e comandos de verificação. Criar allowlist por firmware/modelo e testes.

Fase D — execução controlada: liberar somente depois de aprovação, auditoria, idempotência, verificação pós-operação e rollback testados. Começar com uma ONU de laboratório.

Desprovisionar exige confirmação reforçada, mostra impacto (serviços/VLAN/perfil) e não apaga histórico ou cadastro do cliente.

## Critérios de aceite

- ONU nova é detectada sem provisionar automaticamente.
- Serial já conhecido é associado ao cliente/plano correto ou colocado em revisão se ambíguo.
- ONU que muda de PON gera proposta, não comando automático.
- Bridge e Router aparecem somente quando modelo e parâmetros são compatíveis.
- Usuário sem papel admin não aprova nem executa.
- Toda aprovação registra identidade e hash exato do plano revisado.
- Falha parcial não é apresentada como sucesso; há estado, saída e instrução de recuperação.
- A tela só mostra Online depois de consulta posterior confirmar a ONU na PON esperada.
- Nenhum segredo aparece em Git, logs, respostas HTTP ou histórico de auditoria.

## Bloqueios conhecidos no estado atual do projeto

O agente atual anuncia somente gpon.interface.read, gpon.onu.read e cli.read, e restringe consultas à PON 1/1/2. Não existe persistência de clientes/planos nem autenticação administrativa no repositório atual. O projeto ainda não possui comandos de escrita validados para provisionamento. Esses itens são pré-requisitos reais, não devem ser simulados.
