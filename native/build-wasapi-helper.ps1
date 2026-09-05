param(
  [string]$Source = (Join-Path $PSScriptRoot 'CristiWasapiLoopback.cs'),
  [string]$Output = (Join-Path $PSScriptRoot 'CristiWasapiLoopback.exe')
)

$ErrorActionPreference = 'Stop'
$sourceText = Get-Content -LiteralPath $Source -Raw
$outputDirectory = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Add-Type -TypeDefinition $sourceText -Language CSharp -OutputAssembly $Output -OutputType ConsoleApplication
Write-Output "Built $Output"
