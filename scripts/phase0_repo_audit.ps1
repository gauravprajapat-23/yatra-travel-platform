$ErrorActionPreference = "Stop"

Write-Host "=== YATRA Phase 0 Repository Baseline Audit ==="

Write-Host "`n[1] Git status"
git status --short

Write-Host "`n[2] Runtime versions"
node --version
npm --version

Write-Host "`n[3] Package files"
Get-ChildItem -Recurse -File -Include package.json,package-lock.json,pnpm-lock.yaml,yarn.lock |
  Select-Object FullName

Write-Host "`n[4] Environment files"
Get-ChildItem -Force -File -Name ".env*" -ErrorAction SilentlyContinue

Write-Host "`n[5] Potential secrets tracked by git"
git ls-files | Select-String -Pattern "(\.env$|\.env\.|service-account|key\.json|\.pem$|\.p12$|\.jks$|\.keystore$)"

Write-Host "`n[6] Build/test scripts from root package.json"
if (Test-Path package.json) {
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  $pkg.scripts | Format-List
}

Write-Host "`n=== Audit collection complete ==="
