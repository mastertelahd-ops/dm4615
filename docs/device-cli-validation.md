# Validação da CLI — Datacom DM4615

Este documento registra somente comandos e resultados efetivamente observados no acesso SSH/PuTTY compartilhado. Não generaliza sintaxe de outros modelos ou versões.

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

### `show onu-interface-count`

Executado com sucesso. Retorna tabela com índice, nome da interface, total de ONUs, ONUs provisionadas, ONUs UP e ONUs DOWN.

Trecho observado:

| Interface | Total | Provisionadas | UP | DOWN |
|---|---:|---:|---:|---:|
| gpon-1/1/1 | 0 | 0 | 0 | 0 |
| gpon-1/1/2 | 2 | 0 | 1 | 1 |
| gpon-1/1/3 até gpon-1/1/16 | 0 | 0 | 0 | 0 |

## Comandos ainda não confirmados

- `show onu-global-count`: o texto capturado contém `how onu-global-count` (sem o primeiro caractere) e retornou erro/incomplete path. Não considerar confirmado.
- Inventário, alarmes e interfaces: ainda não há saídas válidas compartilhadas neste registro.
- Não há comandos de provisionamento ou configuração autorizados/validados.

## Próxima coleta no PuTTY

Executar separadamente, no prompt `FireNet-OLT#`, sem alterar configuração:

```text
show inventory
show alarm
show interface
show onu-global-count
```

Se algum comando apresentar `--More--`, pressione `!` para exibir o restante, conforme a ajuda do paginador capturada, ou copie todas as páginas. Para conferir sintaxe sem executar a consulta, use `show <subcomando> ?`.

## Regras de implementação

1. Implementar somente comandos explicitamente confirmados para o firmware instalado.
2. Começar com consultas de leitura.
3. Não liberar comandos `config`, `set`, `no`, `commit`, `reboot`, `clear` ou equivalentes no agente.
4. Não tratar texto da saída como dados confiáveis sem validação/parsing.
5. Nenhuma senha, token ou fingerprint real deve ser versionado.
