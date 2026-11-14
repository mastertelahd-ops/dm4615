# DM4615 Local Agent — MVP de conexão

Agente local Python para testar conectividade SSH com a interface MGMT da Datacom DM4615.

## Escopo desta primeira entrega

- API local de saúde em `GET /health`.
- Teste de autenticação SSH sem executar comandos na OLT.
- Endereço MGMT padrão `192.168.0.25:22`, substituível apenas por configuração local.
- Token de API obrigatório e comparação em tempo constante.
- Verificação obrigatória da impressão digital SHA-256 da chave SSH do equipamento.
- Bind em `127.0.0.1` nos scripts de execução.
- Inicialização para Windows e Linux.

Ainda não há terminal interativo, execução CLI, provisionamento ou modo servidor remoto. Esses recursos dependem da validação do firmware e do desenho de autenticação/transportes. Não informe que a OLT está conectada até um teste real bem-sucedido.

## Windows

1. Conecte o computador diretamente à porta MGMT.
2. Configure a placa Ethernet com um IP livre na mesma sub-rede, por exemplo `192.168.0.10/24`, depois de confirmar que a OLT ainda usa `192.168.0.25/24`.
3. Obtenha a impressão digital SSH da OLT por um canal confiável e confirme-a com o administrador.
4. Gere um token aleatório com pelo menos 32 caracteres.
5. Defina as variáveis de ambiente `DM4615_AGENT_TOKEN` e `DM4615_SSH_HOST_KEY_SHA256`.
6. Execute PowerShell: `./run-windows.ps1`.

## Linux

Execute `bash install-linux.sh`, configure as mesmas variáveis no gerenciador de serviços e inicie Uvicorn vinculado a loopback. Para operação contínua, criar unidade systemd dedicada com usuário sem privilégios e arquivo de ambiente protegido.

## API

- `GET http://127.0.0.1:8765/health`
- `POST http://127.0.0.1:8765/api/v1/connection/test`
- Header: `Authorization: Bearer <token>`
- JSON: `{"username":"...","password":"...","host":"192.168.0.25"}`

A senha é usada apenas na tentativa de conexão e não é persistida nem registrada pelo agente. Não habilite logging de corpos HTTP.

## Segurança e limitações

- Nunca use `AutoAddPolicy` nem aceite uma chave SSH desconhecida automaticamente.
- Não coloque tokens, senhas ou impressões digitais reais no Git.
- A impressão digital deve ser conferida fora de banda; não confie cegamente na primeira conexão.
- O MVP não executa comandos, não altera configuração e não descobre credenciais.
- O script usa loopback. O modo servidor exige projeto separado de implantação, TLS, autenticação de operadores, autorização por OLT, auditoria e controles de rede; não basta trocar o bind para `0.0.0.0`.
- A origem web autorizada deve ser configurada explicitamente em `DM4615_ALLOWED_ORIGINS`.

## Próximas fases

1. Validar build/lint da aplicação web e testes do agente.
2. Integrar a tela de conexão MGMT à API local com confirmação de origem.
3. Implementar terminal interativo com timeout, limites de sessão e auditoria.
4. Criar adaptador DmOS versionado com comandos somente de leitura confirmados no manual da versão instalada.
5. Planejar modo servidor com TLS e controle de acesso.
6. Só depois habilitar operações de configuração/provisionamento, com backup e confirmação explícita.
