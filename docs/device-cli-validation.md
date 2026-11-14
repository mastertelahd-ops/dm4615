# Validação da CLI — Datacom DM4615

Este documento registra somente comandos e resultados efetivamente observados no acesso SSH/PuTTY compartilhado. Não generaliza sintaxe de outros modelos ou versões. As medições são fotografias do momento da coleta, não garantias de estado atual.

## Ambiente observado

- Prompt: `FireNet-OLT#`
- Transporte utilizado pelo operador: SSH via PuTTY.
- O endereço `192.168.0.25` foi informado como IP MGMT pretendido para a integração, mas ainda precisa ser confirmado como endereço da OLT.
- A saída de `show system` apresentou relógio `2000-01-10 04:12:28 UTC+0`, uptime aproximado de 1h28 e motivo do último reboot `Power Failure`. O relógio do equipamento pode estar incorreto; validar SNTP antes de usar timestamps como referência de auditoria.
- CPU observada: uso ativo na faixa de 11–22% nos trechos exibidos.
- Memória observada: total 1.91 GiB, usada aproximadamente 854.73 MiB e disponível 1.08 GiB.

## Comandos de leitura confirmados

### `show system`

Executado com sucesso. Retorna relógio, uptime, motivo do reboot, chassis/slot, utilização de CPU por núcleo e informações de memória.

A saída é paginada pelo utilitário `more`, com marcador `--More--`. A automação SSH deverá tratar paginação explicitamente e limitar o tamanho/tempo de saída.

### `show inventory`

Executado com sucesso. Identifica o equipamento como DM4615 e a placa principal como `16GPON+4GT+4XS`.

Dados observados:
- Chassis/slot: `1/1`.
- Part number da placa: `800.5198.51`; revisão de produto: `51`.
- Número de série da placa: `5020503`.
- Base MAC: `70:cd:91:07:b2:27`.
- Interfaces Gigabit Ethernet: `1/1/1` a `1/1/4`, tipo Electrical.
- Interfaces GPON: `1/1/1` a `1/1/16`.
- Transceptores GPON indicados como presentes: `1/1/1`, `1/1/2`, `1/1/5`, `1/1/6`, `1/1/7`, `1/1/9`, `1/1/10`, `1/1/12`, `1/1/13`, `1/1/14`, `1/1/15` e `1/1/16`.
- Transceptores GPON indicados como ausentes: `1/1/3`, `1/1/4`, `1/1/8` e `1/1/11`.
- Interfaces 10 Gigabit Ethernet: `1/1/1` a `1/1/4`; transceptores indicados como ausentes na captura.
- Ventoinha: modelo `DM4610-FAN`; a saída informa que essa placa não possui inventário.
- Fonte PSU1: modelo `PSU-125-DC`, part number `800.5188.02`.

A captura contém repetições de trechos de inventário associadas à paginação do terminal. Os itens acima foram consolidados como inventário, não como múltiplas placas ou múltiplos equipamentos.

### `show onu-interface-count`

Executado com sucesso. Retorna tabela com índice, nome da interface, total de ONUs, ONUs provisionadas, ONUs UP e ONUs DOWN.

Trecho observado:

| Interface | Total | Provisionadas | UP | DOWN |
|---|---:|---:|---:|---:|
| gpon-1/1/1 | 0 | 0 | 0 | 0 |
| gpon-1/1/2 | 2 | 0 | 1 | 1 |
| gpon-1/1/3 até gpon-1/1/16 | 0 | 0 | 0 | 0 |

### `show onu-global-count`

Executado com sucesso na coleta mais recente. Retorna contagem agregada de ONUs:

| Total | Não provisionadas | UP | DOWN |
|---:|---:|---:|---:|
| 2 | 0 | 1 | 1 |

Os valores agregados são coerentes com o total observado em `show onu-interface-count` na coleta anterior: duas ONUs, uma UP e uma DOWN.

### `show alarm`

Executado com sucesso. Resposta literal observada: `% No entries found.` Portanto, não havia entradas retornadas por essa consulta no instante da coleta. Isso não prova ausência de eventos históricos ou de outros tipos de alerta fora do escopo desse comando.

### `show interface`

Executado com sucesso. Retorna taxas L1/L2 e detalhes de estado/configuração para as interfaces Ethernet, além de tabelas de estado óptico dos transceptores GPON.

**Taxas observadas na coleta:**
- Todas as quatro interfaces Gigabit Ethernet (`1/1/1` a `1/1/4`) apresentaram `0.0bps` em L1 RX, L1 TX, L2 RX e L2 TX.
- Todas as quatro interfaces 10 Gigabit Ethernet (`1/1/1` a `1/1/4`) apresentaram `0.0bps` nas mesmas quatro métricas.

**Estado das interfaces Ethernet:**
- `gigabit-ethernet-1/1/1`: administrativamente Enabled; negociação Enabled; link Up; velocidade/duplex `100Mfull`; MDIX Xover.
- `gigabit-ethernet-1/1/2`, `1/1/3` e `1/1/4`: administrativamente Enabled, negociação Enabled e link Down.
- `ten-gigabit-ethernet-1/1/1` a `1/1/4`: administrativamente Enabled, negociação Disabled, velocidade configurada 10G/full e link Down.
- MTU exibida para essas interfaces: 16361. Descrições vazias.

**Transceptores GPON:**
- A tabela Rx-LOS lista 12 transceptores (portas `1/1/1`, `1/1/2`, `1/1/5`, `1/1/6`, `1/1/7`, `1/1/9`, `1/1/10`, `1/1/12`, `1/1/13`, `1/1/14`, `1/1/15` e `1/1/16`), todos com Rx-LOS exibido como `N/A`.
- A tabela de diagnóstico apresenta temperatura, tensão, corrente, Tx-Power e Rx-Power. Rx-Power aparece como `N/A` em todas as portas listadas.
- Leituras Tx-Power observadas: portas GPON 1/1/1, 1/1/2, 1/1/6, 1/1/7, 1/1/9, 1/1/10, 1/1/12, 1/1/13, 1/1/14, 1/1/15 e 1/1/16 entre 3.08 e 5.11 dBm; porta GPON 1/1/5 exibiu -10.31 dBm.
- A porta GPON 1/1/5 também exibiu corrente de 72.2 mA, enquanto as demais leituras listadas ficaram aproximadamente entre 8.3 e 15.31 mA. Temperaturas observadas variaram de 41.09 a 48.91 °C e tensões de 3.25 a 3.40 V.

A leitura da porta GPON 1/1/5 é discrepante em relação às demais portas na mesma captura e merece nova coleta/checagem física e comparação com limites do fabricante. Não concluir falha do módulo somente com essa amostra. Como Rx-Power e Rx-LOS foram apresentados como `N/A`, o agente não deve convertê-los em zero nem inferir nível óptico recebido.

## Ajuda da CLI — árvore de comandos ONU e interface

Ajuda solicitada no prompt, sem executar configuração:

### `show onu ?`

Completions exibidas:
- `down-onus`: número de ONUs provisionadas e DOWN em todas as interfaces.
- `non-provisioned-onus`: número de ONUs não provisionadas em todas as interfaces.
- `ponIfEntry`: tabela de contagem de ONUs por interface PON.
- `total-onus`: total de ONUs em todas as PONs, incluindo todos os estados.
- `up-onus`: número de ONUs provisionadas e UP em todas as interfaces.

Essas opções foram exibidas pela ajuda; exceto os comandos de contagem já registrados acima, ainda não foi compartilhada a execução individual de cada opção. A tabela `ponIfEntry` é uma candidata para detalhar contagens por PON, mas sua saída precisa ser coletada antes de implementar o parser.

### `show gpon ?`

Retornou erro de sintaxe (`% Invalid input detected at '^' marker.`). Portanto, `show gpon` não está confirmado como ramo válido da CLI nesse contexto.

### `show interface ?`

Completions exibidas:
- `description`: descrição das interfaces.
- `gigabit-ethernet`: informações de interfaces Gigabit Ethernet.
- `gpon`: descrição da ajuda: “Configure a GPON interface”.
- `link`: visão geral do estado das interfaces.
- `ten-gigabit-ethernet`: informações das interfaces 10 Gigabit Ethernet.
- `utilization`: estatísticas de utilização das interfaces.

A palavra `gpon` aparece sob `show interface`, mas a própria descrição sugere contexto de configuração. Não executar esse ramo até confirmar a sintaxe e garantir que a ação é somente leitura. Preferir primeiro explorar `link`, `utilization` e `description` com ajuda `?`.

## Comandos ainda não confirmados

- Não há comandos de provisionamento ou configuração autorizados/validados.
- Não foi validado ainda um comando para listar ONUs individualmente, consultar potência óptica por ONU ou executar ações sobre ONUs.

## Próximas validações recomendadas

1. Repetir `show interface` em outro momento para confirmar se taxas e estados permanecem iguais.
2. Investigar a leitura discrepante do transceptor GPON `1/1/5` por nova coleta e documentação/limites do fabricante, sem executar comandos de escrita.
3. Identificar comandos de consulta por ONU e por interface GPON usando ajuda da CLI; validar cada comando no equipamento antes de automatizar.
4. Confirmar se `192.168.0.25` é o IP da OLT e obter fingerprint SSH por canal confiável.
5. Validar sincronismo de relógio (SNTP) antes de depender de timestamps da OLT.

Se algum comando apresentar `--More--`, pressione `!` para exibir o restante, conforme a ajuda do paginador capturada, ou copie todas as páginas. Para conferir sintaxe sem executar a consulta, use a ajuda da CLI observada no equipamento.

## Regras de implementação

1. Implementar somente comandos explicitamente confirmados para o firmware instalado.
2. Começar com consultas de leitura.
3. Não liberar comandos `config`, `set`, `no`, `commit`, `reboot`, `clear` ou equivalentes no agente.
4. Não tratar texto da saída como dados confiáveis sem validação/parsing.
5. Preservar valores `N/A` como indisponíveis, nunca como zero.
6. Nenhuma senha, token ou fingerprint real deve ser versionado.
