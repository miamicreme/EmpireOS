param(
  [switch]$SkipDbPush,
  [switch]$SkipTypeGeneration,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Command
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not on PATH. Install it, then rerun this script."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Invoke-Step "Checking required CLIs" {
  Assert-Command "supabase"
  Assert-Command "npm"
  supabase --version
}

Invoke-Step "Listing Supabase migrations" {
  Get-ChildItem ".\supabase\migrations" | Select-Object Name
}

if (-not $SkipDbPush) {
  Invoke-Step "Applying pending Supabase migrations" {
    supabase db push
  }
}

if (-not $SkipTypeGeneration) {
  Invoke-Step "Generating Supabase TypeScript types" {
    supabase gen types typescript --linked | Set-Content -Encoding UTF8 ".\src\lib\supabase\database.types.ts"
  }
}

Invoke-Step "Running TypeScript check" {
  npm run typecheck
}

if (-not $SkipBuild) {
  Invoke-Step "Running production build" {
    npm run build
  }
}

Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Green
