[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if (-not $tailscale) {
    $candidates = @(
        "$env:ProgramFiles\Tailscale\tailscale.exe",
        "${env:ProgramFiles(x86)}\Tailscale\tailscale.exe"
    )
    $found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($found) { $tailscalePath = $found } else {
        Write-Host "Tailscale não encontrado neste Windows." -ForegroundColor Yellow
        Write-Host "Instale pelo site oficial: https://tailscale.com/download/windows"
        exit 2
    }
} else {
    $tailscalePath = $tailscale.Source
}

Write-Host "Tailscale CLI: $tailscalePath"
$statusJson = & $tailscalePath status --json
if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível consultar o estado do Tailscale. Abra o aplicativo e autentique o dispositivo."
}

try { $status = $statusJson | ConvertFrom-Json } catch {
    throw "O Tailscale retornou um estado que não pôde ser interpretado."
}

if (-not $status.Self) {
    throw "O estado do Tailscale não contém informações do dispositivo local."
}

Write-Host "Dispositivo: $($status.Self.HostName)"
Write-Host "DNS privado: $($status.Self.DNSName)"
Write-Host "Conectado: $($status.Self.Online)"
Write-Host "IPs Tailscale: $($status.Self.TailscaleIPs -join ', ')"

if (-not $status.Self.Online) {
    Write-Warning "Este dispositivo não aparece online no tailnet."
    exit 3
}

Write-Host ""
Write-Host "Diagnóstico concluído. Nenhuma configuração foi alterada."
Write-Host "A API do agente continua restrita a 127.0.0.1:17861."
Write-Host "Não habilite Tailscale Serve para a API até concluir autenticação de usuário/dispositivo no agente."
