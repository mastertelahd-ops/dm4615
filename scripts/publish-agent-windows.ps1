[CmdletBinding()]
param(
    [ValidateSet("win-x64", "win-arm64")]
    [string]$Runtime = "win-x64",
    [switch]$BuildInstaller
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot "src/agent/Dm4615.Agent.csproj"
$publishDir = Join-Path $repoRoot "artifacts/$Runtime"
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET 8 SDK não encontrado. Instale o SDK .NET 8 antes de continuar."
}
dotnet publish $project -c Release -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $publishDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish falhou com código $LASTEXITCODE." }
Write-Host "Executável portátil publicado em: $publishDir"
Write-Host "Não foram incluídas credenciais, fingerprints ou tokens."
if ($BuildInstaller) {
    $iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if (-not $iscc) { throw "Inno Setup (ISCC.exe) não encontrado. Instale o Inno Setup 6 e repita com -BuildInstaller." }
    & $iscc.Source (Join-Path $repoRoot "installer/FireNetAgent.iss")
    if ($LASTEXITCODE -ne 0) { throw "Compilação do instalador falhou." }
}
