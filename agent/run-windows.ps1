$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
  py -3 -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

if (-not $env:DM4615_AGENT_TOKEN -or -not $env:DM4615_SSH_HOST_KEY_SHA256) {
  throw "Configure DM4615_AGENT_TOKEN e DM4615_SSH_HOST_KEY_SHA256 antes de iniciar. Não use valores de exemplo."
}

# Bind exclusivo em loopback: o agente não fica exposto à rede local.
& .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8765
