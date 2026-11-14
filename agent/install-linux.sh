#!/usr/bin/env bash
set -euo pipefail

# Instala o agente no diretório atual. A configuração e os segredos devem ser
# fornecidos por um gerenciador de serviços/segredos, nunca versionados no Git.
ROOT="$(cd "$(dirname "$0")" && pwd)"
python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install --upgrade pip
"$ROOT/.venv/bin/pip" install -r "$ROOT/requirements.txt"

cat <<EOF
Dependências instaladas em: $ROOT/.venv
Configure DM4615_AGENT_TOKEN e DM4615_SSH_HOST_KEY_SHA256 no serviço systemd.
Inicie com:
  $ROOT/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8765
Não exponha a porta 8765 diretamente à internet.
EOF
