#!/usr/bin/env pwsh
#
# envsec — End-to-End Integration Test (Windows / PowerShell)
#
# Mirrors test/e2e-test.sh for Windows CI.
# Uses contexts "test.e2e" / "test.e2e-second" to avoid interfering with real data.
# Cleans up everything at the end and verifies no orphan secrets remain.
#
param()

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CLI = Join-Path $ScriptDir ".." "dist" "main.js"
$CTX = "test.e2e"
$CTX2 = "test.e2e-second"
$script:PASS = 0
$script:FAIL = 0

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Green($msg)  { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Red($msg)    { Write-Host "  ✗ $msg" -ForegroundColor Red }

function Assert-Eq {
    param([string]$Name, [string]$Expected, [string]$Actual)
    if ($Expected -eq $Actual) {
        Green $Name; $script:PASS++
    } else {
        Red $Name; Red "    expected: '$Expected'"; Red "    actual:   '$Actual'"; $script:FAIL++
    }
}

function Assert-Contains {
    param([string]$Name, [string]$Needle, [string]$Haystack)
    if ($Haystack.Contains($Needle)) {
        Green $Name; $script:PASS++
    } else {
        Red $Name; Red "    expected to contain: '$Needle'"; Red "    got: '$Haystack'"; $script:FAIL++
    }
}

function Assert-NotContains {
    param([string]$Name, [string]$Needle, [string]$Haystack)
    if (-not $Haystack.Contains($Needle)) {
        Green $Name; $script:PASS++
    } else {
        Red $Name; Red "    should NOT contain: '$Needle'"; $script:FAIL++
    }
}

function Assert-ExitCode {
    param([string]$Name, [int]$Expected, [int]$Actual)
    if ($Expected -eq $Actual) {
        Green $Name; $script:PASS++
    } else {
        Red $Name; Red "    expected exit: $Expected, got: $Actual"; $script:FAIL++
    }
}

function Run-Ok {
    param([string[]]$CmdArgs)
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $out = & node $CLI @CmdArgs 2>$stderrFile
        return ($out -join "`n")
    } finally {
        Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Run-All {
    param([string[]]$CmdArgs)
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $stdout = & node $CLI @CmdArgs 2>$stderrFile
        $stderr = Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue
        $combined = @()
        if ($stdout) { $combined += $stdout }
        if ($stderr) { $combined += $stderr }
        return ($combined -join "`n")
    } finally {
        Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Cleanup-Secrets {
    foreach ($key in @("db.password", "api.token", "special.chars", "special.emoji", "special.utf8", "stale.secret")) {
        & node $CLI -c $CTX delete -y $key 2>$null | Out-Null
    }
    foreach ($key in @("redis.host", "redis.port", "redis.password", "smtp.user", "smtp.pass")) {
        & node $CLI -c $CTX2 delete -y $key 2>$null | Out-Null
    }
    & node $CLI -c "test.e2e-all" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-expiry" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-rename" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-move-src" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-move-dst" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-copy-src" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-copy-dst" delete --all -y 2>$null | Out-Null
    & node $CLI cmd delete "test-echo" 2>$null | Out-Null
    & node $CLI cmd delete "test-multi" 2>$null | Out-Null
}

Cleanup-Secrets

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "envsec-e2e-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

try {

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "  envsec — End-to-End Integration Test (Windows)"
Write-Host "═══════════════════════════════════════════════════════════════"

# ─── 1. ADD & GET ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 1. ADD & GET ──"

$out = Run-Ok @("-c", $CTX, "add", "db.password", "-v", "supersecret123")
Assert-Contains "add: conferma" "stored" $out

$out = Run-Ok @("-c", $CTX, "get", "db.password")
Assert-Eq "get: valore corretto" "supersecret123" $out.Trim()

Run-Ok @("-c", $CTX, "add", "api.token", "-v", "tok_abc_999") | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "api.token")
Assert-Eq "get: secondo segreto" "tok_abc_999" $out.Trim()

# Overwrite
Run-Ok @("-c", $CTX, "add", "db.password", "-v", "newpassword") | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "db.password")
Assert-Eq "add: sovrascrittura" "newpassword" $out.Trim()

# Special characters — now handled via P/Invoke (no cmdkey escaping issues)
$SpecialValue = 'p@ss w0rd!#$%'
Run-Ok @("-c", $CTX, "add", "special.chars", "-v", $SpecialValue) | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "special.chars")
Assert-Eq "get: caratteri speciali" $SpecialValue $out.Trim()

# Non-ASCII / emoji (values are base64-encoded internally, works on all OS)
Run-Ok @("-c", $CTX, "add", "special.emoji", "-v", "hello ⭐ world 🚀") | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "special.emoji")
Assert-Eq "get: emoji value decoded" "hello ⭐ world 🚀" $out.Trim()

Run-Ok @("-c", $CTX, "add", "special.utf8", "-v", "café résumé naïve") | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "special.utf8")
Assert-Eq "get: accented chars" "café résumé naïve" $out.Trim()

# ─── 1b. GET --quiet ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 1b. GET --quiet ──"

$out = Run-Ok @("-c", $CTX, "get", "-q", "db.password")
Assert-Eq "get -q: only value" "newpassword" $out.Trim()

$out = Run-Ok @("-c", $CTX, "get", "--quiet", "api.token")
Assert-Eq "get --quiet: only value" "tok_abc_999" $out.Trim()

# ─── 2. LIST ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 2. LIST ──"

$out = Run-Ok @("-c", $CTX, "list")
Assert-Contains "list: db.password" "db.password" $out
Assert-Contains "list: api.token" "api.token" $out
Assert-Contains "list: special.chars" "special.chars" $out
Assert-Contains "list: summary count" "5 secrets in $CTX" $out

$out = Run-Ok @("list")
Assert-Contains "list contesti: test.e2e" "test.e2e" $out

$out = Run-Ok @("-c", $CTX, "--json", "list")
Assert-Contains "list --json: array" "[" $out
Assert-Contains "list --json: chiave" "db.password" $out

# ─── 3. SEARCH ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 3. SEARCH ──"

$out = Run-Ok @("-c", $CTX, "search", "db*")
Assert-Contains "search: db.password" "db.password" $out
Assert-NotContains "search: no api.token" "api.token" $out

$out = Run-Ok @("-c", $CTX, "search", "*token*")
Assert-Contains "search wildcard: api.token" "api.token" $out

$out = Run-Ok @("search", "test*")
Assert-Contains "search contesti: test.e2e" "test.e2e" $out

# ─── 4. ENV-FILE ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 4. ENV-FILE ──"

$EnvOut = Join-Path $TmpDir "test.env"
$out = Run-Ok @("-c", $CTX, "env-file", "-o", $EnvOut)
Assert-Contains "env-file: scritto" "Written" $out

$envContent = Get-Content $EnvOut -Raw
Assert-Contains "env-file: DB_PASSWORD" 'DB_PASSWORD="newpassword"' $envContent
Assert-Contains "env-file: API_TOKEN" 'API_TOKEN="tok_abc_999"' $envContent
Assert-Contains "env-file: quotato" '"' $envContent

# ─── 4b. ENV (export to stdout) ──────────────────────────────────────────────
Write-Host ""
Write-Host "── 4b. ENV ──"

$out = Run-Ok @("-c", $CTX, "env")
Assert-Contains "env: bash export db.password" "export DB_PASSWORD=" $out
Assert-Contains "env: bash export api.token" "export API_TOKEN=" $out
Assert-Contains "env: bash value" "newpassword" $out

$out = Run-Ok @("-c", $CTX, "env", "--shell", "bash")
Assert-Contains "env --shell bash: export" "export DB_PASSWORD=" $out

$out = Run-Ok @("-c", $CTX, "env", "--shell", "fish")
Assert-Contains "env --shell fish: set -gx" "set -gx DB_PASSWORD" $out

$out = Run-Ok @("-c", $CTX, "env", "--shell", "powershell")
Assert-Contains "env --shell powershell: `$env:" '$env:DB_PASSWORD' $out

$out = Run-Ok @("-c", $CTX, "env", "--unset")
Assert-Contains "env --unset bash: unset" "unset DB_PASSWORD" $out
Assert-Contains "env --unset bash: unset api" "unset API_TOKEN" $out

$out = Run-Ok @("-c", $CTX, "env", "--unset", "--shell", "fish")
Assert-Contains "env --unset fish: set -e" "set -e DB_PASSWORD" $out

$out = Run-Ok @("-c", $CTX, "env", "--unset", "--shell", "powershell")
Assert-Contains "env --unset powershell: Remove-Item" "Remove-Item" $out

# Empty context
$out = Run-All @("-c", "nonexistent.ctx.e2e", "env")
Assert-Contains "env: empty context message" "No secrets" $out

# ─── 5. LOAD ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 5. LOAD ──"

$LoadEnv = Join-Path $TmpDir "load-test.env"
@"
# Comment — should be ignored
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=r3d1s_s3cr3t

SMTP_USER=mailer@example.com
SMTP_PASS="quoted value with spaces"
"@ | Set-Content -Path $LoadEnv -Encoding UTF8

$out = Run-Ok @("-c", $CTX2, "load", "-i", $LoadEnv)
Assert-Contains "load: done" "Done" $out
Assert-Contains "load: added" "added" $out

$out = Run-Ok @("-c", $CTX2, "get", "redis.host")
Assert-Eq "load: redis.host" "localhost" $out.Trim()

$out = Run-Ok @("-c", $CTX2, "get", "redis.port")
Assert-Eq "load: redis.port" "6379" $out.Trim()

$out = Run-Ok @("-c", $CTX2, "get", "redis.password")
Assert-Eq "load: redis.password" "r3d1s_s3cr3t" $out.Trim()

$out = Run-Ok @("-c", $CTX2, "get", "smtp.user")
Assert-Eq "load: smtp.user" "mailer@example.com" $out.Trim()

$out = Run-Ok @("-c", $CTX2, "get", "smtp.pass")
Assert-Eq "load: smtp.pass (quoted)" "quoted value with spaces" $out.Trim()

# Without --force: should skip duplicates
$out = Run-Ok @("-c", $CTX2, "load", "-i", $LoadEnv)
Assert-Contains "load no-force: skip" "skipped" $out

# With --force: should overwrite
$out = Run-Ok @("-c", $CTX2, "load", "-i", $LoadEnv, "-f")
Assert-Contains "load --force: overwritten" "overwritten" $out

# ─── 6. DELETE ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 6. DELETE ──"

$out = Run-Ok @("-c", $CTX, "delete", "-y", "special.chars")
Assert-Contains "delete: confirmed" "removed" $out

# Verify secret no longer exists
$ec = 0
& node $CLI -c $CTX get special.chars 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { $ec = $LASTEXITCODE }
Assert-ExitCode "delete: get fails after delete" 1 $ec

# Other secrets still intact
$out = Run-Ok @("-c", $CTX, "get", "db.password")
Assert-Eq "delete: others intact" "newpassword" $out.Trim()

# ─── 6b. DELETE --all ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 6b. DELETE --all ──"

$CTX_ALL = "test.e2e-all"
Run-Ok @("-c", $CTX_ALL, "add", "one.key", "-v", "v1") | Out-Null
Run-Ok @("-c", $CTX_ALL, "add", "two.key", "-v", "v2") | Out-Null
Run-Ok @("-c", $CTX_ALL, "add", "three.key", "-v", "v3") | Out-Null

$out = Run-Ok @("-c", $CTX_ALL, "list")
Assert-Contains "delete --all: seeded one.key" "one.key" $out
Assert-Contains "delete --all: seeded two.key" "two.key" $out
Assert-Contains "delete --all: seeded three.key" "three.key" $out

$out = Run-Ok @("-c", $CTX_ALL, "delete", "--all", "-y")
Assert-Contains "delete --all: removed count" "Removed 3" $out

$out = Run-Ok @("-c", $CTX_ALL, "list")
Assert-Contains "delete --all: context empty" "No secrets" $out

$out = Run-Ok @("-c", $CTX_ALL, "delete", "--all", "-y")
Assert-Contains "delete --all: empty context" "No secrets" $out

# ─── 7. RUN ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 7. RUN ──"

$out = Run-Ok @("-c", $CTX, "run", "echo hello-no-secrets")
Assert-Contains "run: no secrets" "hello-no-secrets" $out

$out = Run-Ok @("-c", $CTX, "run", "echo {db.password}")
Assert-Contains "run: interpolation" "newpassword" $out

# Missing secret
$out = Run-All @("-c", $CTX, "run", "echo {nonexistent.key}")
$ec = $LASTEXITCODE
Assert-ExitCode "run: missing secret fails" 1 $ec
Assert-Contains "run: missing message" "Missing" $out

# ─── 8. CMD ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 8. CMD ──"

$out = Run-Ok @("-c", $CTX, "run", "-s", "-n", "test-echo", "echo {db.password}")
Assert-Contains "cmd save: executed" "newpassword" $out

$out = Run-Ok @("cmd", "list")
Assert-Contains "cmd list: test-echo" "test-echo" $out

$out = Run-Ok @("cmd", "run", "test-echo")
Assert-Contains "cmd run: executed" "newpassword" $out

# cmd run --quiet: suppress informational output
$out = Run-Ok @("cmd", "run", "-q", "test-echo")
Assert-Contains "cmd run -q: executed" "newpassword" $out
Assert-NotContains "cmd run -q: no resolved msg" "Resolved" $out

$out = Run-Ok @("cmd", "run", "--quiet", "test-echo")
Assert-Contains "cmd run --quiet: executed" "newpassword" $out
Assert-NotContains "cmd run --quiet: no resolved msg" "Resolved" $out

$out = Run-Ok @("cmd", "search", "test*")
Assert-Contains "cmd search: test-echo" "test-echo" $out

$out = Run-Ok @("cmd", "delete", "test-echo")
Assert-Contains "cmd delete: confirmed" "removed" $out

& node $CLI cmd run test-echo 2>$null | Out-Null
$ec = $LASTEXITCODE
Assert-ExitCode "cmd delete: run fails after" 1 $ec

# ─── 9. ENVSEC_CONTEXT env var ───────────────────────────────────────────────
Write-Host ""
Write-Host "── 9. ENVSEC_CONTEXT ──"

$env:ENVSEC_CONTEXT = $CTX
$out = Run-Ok @("get", "db.password")
Assert-Eq "env var: get without -c" "newpassword" $out.Trim()

$out = Run-Ok @("list")
Assert-Contains "env var: list without -c" "db.password" $out
$env:ENVSEC_CONTEXT = $null

# ─── 10. ERROR HANDLING ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 10. ERRORS ──"

& node $CLI get db.password 2>$null | Out-Null
Assert-ExitCode "error: missing context" 1 $LASTEXITCODE

Run-Ok @("-c", $CTX, "add", "singlepart", "-v", "test-single") | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "singlepart")
Assert-Eq "add: single-part key works" "test-single" $out.Trim()
Run-Ok @("-c", $CTX, "delete", "-y", "singlepart") | Out-Null

& node $CLI -c $CTX add "a..b" -v test 2>$null | Out-Null
Assert-ExitCode "error: key with empty parts" 1 $LASTEXITCODE

& node $CLI -c "../../etc" get db.password 2>$null | Out-Null
Assert-ExitCode "error: path traversal context" 1 $LASTEXITCODE

& node $CLI -c $CTX load -i "C:\nonexistent\file.env" 2>$null | Out-Null
Assert-ExitCode "error: load missing file" 1 $LASTEXITCODE

# ─── 11. JSON OUTPUT ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 11. JSON ──"

$out = Run-Ok @("-c", $CTX, "--json", "get", "db.password")
Assert-Contains "json get: context field" '"context"' $out
Assert-Contains "json get: key field" '"key"' $out
Assert-Contains "json get: value field" '"value"' $out

$out = Run-Ok @("--json", "list")
Assert-Contains "json list: is array" "[" $out

# ─── 12. CUSTOM DATABASE PATH ────────────────────────────────────────────────
Write-Host ""
Write-Host "── 12. CUSTOM DB PATH ──"

$CustomDb = Join-Path $TmpDir "custom-store.sqlite"

$out = Run-Ok @("--db", $CustomDb, "-c", $CTX, "add", "db.custom", "-v", "custom-value")
Assert-Contains "db flag: add" "stored" $out

$out = Run-Ok @("--db", $CustomDb, "-c", $CTX, "get", "db.custom")
Assert-Eq "db flag: get" "custom-value" $out.Trim()

$out = Run-Ok @("--db", $CustomDb, "-c", $CTX, "list")
Assert-Contains "db flag: list shows custom secret" "db.custom" $out
Assert-NotContains "db flag: list no default secrets" "api.token" $out

$CustomDb2 = Join-Path $TmpDir "custom-store2.sqlite"
$env:ENVSEC_DB = $CustomDb2
$out = Run-Ok @("-c", $CTX, "add", "db.envvar", "-v", "envvar-value")
Assert-Contains "ENVSEC_DB: add" "stored" $out

$out = Run-Ok @("-c", $CTX, "get", "db.envvar")
Assert-Eq "ENVSEC_DB: get" "envvar-value" $out.Trim()

# --db flag takes precedence over ENVSEC_DB
$out = Run-Ok @("--db", $CustomDb, "-c", $CTX, "get", "db.custom")
Assert-Eq "db flag precedence over ENVSEC_DB" "custom-value" $out.Trim()
$env:ENVSEC_DB = $null

if (Test-Path $CustomDb) {
    Green "db flag: file created"; $script:PASS++
} else {
    Red "db flag: file not created at $CustomDb"; $script:FAIL++
}

# Clean up custom DB secrets
Run-Ok @("--db", $CustomDb, "-c", $CTX, "delete", "-y", "db.custom") | Out-Null
$env:ENVSEC_DB = $CustomDb2
Run-Ok @("-c", $CTX, "delete", "-y", "db.envvar") | Out-Null
$env:ENVSEC_DB = $null

# ─── 13. SECRET EXPIRY & AUDIT ───────────────────────────────────────────────
Write-Host ""
Write-Host "── 13. SECRET EXPIRY & AUDIT ──"

$CTX_EXP = "test.e2e-expiry"

$out = Run-Ok @("-c", $CTX_EXP, "add", "exp.short", "-v", "shortlived", "--expires", "1m")
Assert-Contains "add --expires: stored" "stored" $out
Assert-Contains "add --expires: expiry note" "expires:" $out

$out = Run-Ok @("-c", $CTX_EXP, "add", "exp.long", "-v", "longlived", "--expires", "1y")
Assert-Contains "add --expires long: stored" "stored" $out

Run-Ok @("-c", $CTX_EXP, "add", "exp.none", "-v", "noexpiry") | Out-Null

$out = Run-Ok @("-c", $CTX_EXP, "list")
Assert-Contains "list expiry: exp.short" "exp.short" $out
Assert-Contains "list expiry: expires marker" "expires" $out

$out = Run-Ok @("-c", $CTX_EXP, "--json", "get", "exp.short")
Assert-Contains "get json: expires_at field" '"expires_at"' $out

$out = Run-Ok @("-c", $CTX_EXP, "--json", "get", "exp.none")
Assert-Contains "get json: null expires_at" "null" $out

$out = Run-Ok @("-c", $CTX_EXP, "audit", "--within", "30d")
Assert-Contains "audit 30d: finds short" "exp.short" $out
Assert-NotContains "audit 30d: no long" "exp.long" $out

$out = Run-Ok @("-c", $CTX_EXP, "audit", "--within", "2y")
Assert-Contains "audit 2y: finds short" "exp.short" $out
Assert-Contains "audit 2y: finds long" "exp.long" $out

$out = Run-Ok @("audit", "--within", "2y")
Assert-Contains "audit all: finds expiry context" $CTX_EXP $out

$out = Run-Ok @("-c", $CTX_EXP, "--json", "audit", "--within", "2y")
Assert-Contains "audit json: is array" "[" $out
Assert-Contains "audit json: has key" '"key"' $out
Assert-Contains "audit json: has expired field" '"expired"' $out

$out = Run-Ok @("-c", $CTX_EXP, "audit", "--within", "0m")
Assert-Contains "audit 0m: nothing expired" "No secrets" $out

# Invalid duration
& node $CLI -c $CTX_EXP add exp.bad -v "x" --expires "abc" 2>$null | Out-Null
Assert-ExitCode "add: invalid duration fails" 1 $LASTEXITCODE

# Update expiry on existing secret
$out = Run-Ok @("-c", $CTX_EXP, "add", "exp.short", "-v", "updated", "--expires", "7d")
Assert-Contains "add update expiry: stored" "stored" $out

Run-Ok @("-c", $CTX_EXP, "delete", "--all", "-y") | Out-Null

# ─── 14. ENV FILE EXPORT TRACKING ────────────────────────────────────────────
Write-Host ""
Write-Host "── 14. ENV FILE EXPORT TRACKING ──"

# Generate an env file — should be tracked
$EnvTrackOut = Join-Path $TmpDir "first-tracked.env"
Run-Ok @("-c", $CTX, "env-file", "-o", $EnvTrackOut) | Out-Null

# Audit should show the generated env file
$out = Run-Ok @("-c", $CTX, "audit", "--within", "30d")
Assert-Contains "audit env-file: shows path" $EnvTrackOut $out
Assert-Contains "audit env-file: section header" "Generated .env files" $out

# Generate a second env file with different path
$EnvTrackOut2 = Join-Path $TmpDir "second-tracked.env"
Run-Ok @("-c", $CTX, "env-file", "-o", $EnvTrackOut2) | Out-Null

# Audit without context should show all env files
$out = Run-Ok @("audit", "--within", "30d")
Assert-Contains "audit all env-files: first path" $EnvTrackOut $out
Assert-Contains "audit all env-files: second path" $EnvTrackOut2 $out

# Audit JSON should include env_files array
$out = Run-Ok @("-c", $CTX, "--json", "audit", "--within", "30d")
Assert-Contains "audit json: has env_files" '"env_files"' $out
Assert-Contains "audit json: has secrets key" '"secrets"' $out
# In JSON output, backslashes are escaped as \\, so we must match the escaped form
$EnvTrackOutJson = $EnvTrackOut.Replace('\', '\\')
Assert-Contains "audit json: env file path" $EnvTrackOutJson $out

# Delete a tracked env file and verify audit prunes it
Remove-Item $EnvTrackOut -Force -ErrorAction SilentlyContinue
$out = Run-Ok @("-c", $CTX, "audit", "--within", "30d")
Assert-Contains "audit prune: stale removed msg" "stale" $out
Assert-NotContains "audit prune: removed file gone" $EnvTrackOut $out
Assert-Contains "audit prune: existing file still shown" $EnvTrackOut2 $out

# Second audit should not show stale message (already cleaned)
$out = Run-Ok @("-c", $CTX, "audit", "--within", "30d")
Assert-NotContains "audit prune: no stale on second run" "stale" $out

# ─── 15. SHARE (GPG ENCRYPTION) ───────────────────────────────────────────────
Write-Host ""
Write-Host "── 15. SHARE ──"

# GPG tests are skipped on Windows CI.
# The GPG binary on GitHub Actions windows-latest is Git for Windows' MSYS2 build.
# MSYS2 automatically converts GNUPGHOME from Windows paths to Unix-style paths,
# but does it incorrectly (e.g. C:\Users\... becomes /d/a/.../C:\Users\...).
# Since share.ts uses execSync which inherits env vars, there's no way to prevent
# the MSYS2 path mangling. GPG share functionality is fully tested on macOS/Linux CI.
Write-Host "  ⚠ Skipping GPG share tests on Windows (MSYS2 path conversion issues)" -ForegroundColor Yellow

# ─── 16. STALE METADATA (get/delete orphaned secrets) ─────────────────────────
Write-Host ""
Write-Host "── 16. STALE METADATA ──"

$CTX_STALE = "test.e2e"

# Add a secret normally
Run-Ok @("-c", $CTX_STALE, "add", "stale.secret", "-v", "will-be-orphaned") | Out-Null

# Verify it works
$out = Run-Ok @("-c", $CTX_STALE, "get", "stale.secret")
Assert-Eq "stale: get before removal" "will-be-orphaned" $out.Trim()

# Delete directly from Windows Credential Manager (bypass envsec), leaving metadata orphaned
# target = envsec:<service>/<account> where service = envsec.<context>.<prefix>, account = <last part>
& cmd /c "cmdkey /delete:`"envsec:envsec.${CTX_STALE}.stale/secret`"" 2>$null | Out-Null

# get should fail with a helpful message suggesting delete
$out = Run-All @("-c", $CTX_STALE, "get", "stale.secret")
$ec = $LASTEXITCODE
Assert-ExitCode "stale: get exits with error" 1 $ec
Assert-Contains "stale: get mentions missing from keychain" "missing from the OS keychain" $out
Assert-Contains "stale: get suggests delete command" "envsec delete" $out

# get --quiet should also show the suggestion
$out = Run-All @("-c", $CTX_STALE, "get", "-q", "stale.secret")
$ec = $LASTEXITCODE
Assert-ExitCode "stale: get -q exits with error" 1 $ec
Assert-Contains "stale: get -q suggests delete" "envsec delete" $out

# list should still show the key (metadata exists)
$out = Run-Ok @("-c", $CTX_STALE, "list")
Assert-Contains "stale: list still shows key" "stale.secret" $out

# delete should succeed and clean up the orphaned metadata
$out = Run-Ok @("-c", $CTX_STALE, "delete", "-y", "stale.secret")
Assert-Contains "stale: delete succeeds" "removed" $out

# After delete, list should no longer show the key
$out = Run-Ok @("-c", $CTX_STALE, "list")
Assert-NotContains "stale: list after cleanup" "stale.secret" $out

# get should now fail with standard not found (no metadata either)
& node $CLI -c $CTX_STALE get stale.secret 2>$null | Out-Null
Assert-ExitCode "stale: get after cleanup fails" 1 $LASTEXITCODE

# ─── 17. RENAME ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 17. RENAME ──"

$CTX_REN = "test.e2e-rename"

# Seed secrets
Run-Ok @("-c", $CTX_REN, "add", "old.key", "-v", "rename-value") | Out-Null
Run-Ok @("-c", $CTX_REN, "add", "existing.key", "-v", "existing-value") | Out-Null

# Basic rename
$out = Run-Ok @("-c", $CTX_REN, "rename", "old.key", "new.key")
Assert-Contains "rename: success" "Renamed" $out
Assert-Contains "rename: shows old key" "old.key" $out
Assert-Contains "rename: shows new key" "new.key" $out

# Verify value moved
$out = Run-Ok @("-c", $CTX_REN, "get", "new.key")
Assert-Eq "rename: value preserved" "rename-value" $out.Trim()

# Old key should be gone
& node $CLI -c $CTX_REN get old.key 2>$null | Out-Null
Assert-ExitCode "rename: old key gone" 1 $LASTEXITCODE

# Rename to existing key without --force should fail
$out = Run-All @("-c", $CTX_REN, "rename", "new.key", "existing.key")
$ec = $LASTEXITCODE
Assert-ExitCode "rename: conflict fails" 1 $ec
Assert-Contains "rename: conflict message" "already exists" $out

# Rename to existing key with --force should succeed
$out = Run-Ok @("-c", $CTX_REN, "rename", "new.key", "existing.key", "-f")
Assert-Contains "rename: force success" "Renamed" $out

$out = Run-Ok @("-c", $CTX_REN, "get", "existing.key")
Assert-Eq "rename: force value" "rename-value" $out.Trim()

# Rename same key should fail
$out = Run-All @("-c", $CTX_REN, "rename", "existing.key", "existing.key")
$ec = $LASTEXITCODE
Assert-ExitCode "rename: same key fails" 1 $ec

# JSON output
Run-Ok @("-c", $CTX_REN, "add", "json.test", "-v", "json-val") | Out-Null
$out = Run-Ok @("-c", $CTX_REN, "--json", "rename", "json.test", "json.renamed")
Assert-Contains "rename json: action" '"rename"' $out
Assert-Contains "rename json: from" '"json.test"' $out
Assert-Contains "rename json: to" '"json.renamed"' $out

# Clean up
Run-Ok @("-c", $CTX_REN, "delete", "--all", "-y") | Out-Null

# ─── 18. MOVE ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 18. MOVE ──"

$CTX_MSRC = "test.e2e-move-src"
$CTX_MDST = "test.e2e-move-dst"

# Seed source context
Run-Ok @("-c", $CTX_MSRC, "add", "redis.host", "-v", "localhost") | Out-Null
Run-Ok @("-c", $CTX_MSRC, "add", "redis.port", "-v", "6379") | Out-Null
Run-Ok @("-c", $CTX_MSRC, "add", "redis.password", "-v", "r3d1s") | Out-Null
Run-Ok @("-c", $CTX_MSRC, "add", "api.token", "-v", "tok_move") | Out-Null

# Move single key
$out = Run-Ok @("-c", $CTX_MSRC, "move", "api.token", "--to", $CTX_MDST)
Assert-Contains "move single: success" "Moved" $out
Assert-Contains "move single: count" "1 secret" $out

# Verify moved
$out = Run-Ok @("-c", $CTX_MDST, "get", "api.token")
Assert-Eq "move single: value in target" "tok_move" $out.Trim()

# Source should not have it
& node $CLI -c $CTX_MSRC get api.token 2>$null | Out-Null
Assert-ExitCode "move single: gone from source" 1 $LASTEXITCODE

# Move with glob pattern (redis.*)
$out = Run-Ok @("-c", $CTX_MSRC, "move", "redis.*", "--to", $CTX_MDST, "-y")
Assert-Contains "move glob: success" "Moved" $out
Assert-Contains "move glob: count" "3 secrets" $out

# Verify all redis keys moved
$out = Run-Ok @("-c", $CTX_MDST, "get", "redis.host")
Assert-Eq "move glob: redis.host" "localhost" $out.Trim()
$out = Run-Ok @("-c", $CTX_MDST, "get", "redis.port")
Assert-Eq "move glob: redis.port" "6379" $out.Trim()
$out = Run-Ok @("-c", $CTX_MDST, "get", "redis.password")
Assert-Eq "move glob: redis.password" "r3d1s" $out.Trim()

# Source should be empty
$out = Run-Ok @("-c", $CTX_MSRC, "list")
Assert-Contains "move glob: source empty" "No secrets" $out

# Move with --all
Run-Ok @("-c", $CTX_MSRC, "add", "new.one", "-v", "v1") | Out-Null
Run-Ok @("-c", $CTX_MSRC, "add", "new.two", "-v", "v2") | Out-Null

# Clean target first to avoid conflicts
Run-Ok @("-c", $CTX_MDST, "delete", "--all", "-y") | Out-Null

$out = Run-Ok @("-c", $CTX_MSRC, "move", "--all", "--to", $CTX_MDST, "-y")
Assert-Contains "move all: success" "Moved" $out
Assert-Contains "move all: count" "2 secrets" $out

# Conflict detection
Run-Ok @("-c", $CTX_MSRC, "add", "conflict.key", "-v", "src-val") | Out-Null
Run-Ok @("-c", $CTX_MDST, "add", "conflict.key", "-v", "dst-val") | Out-Null

$out = Run-All @("-c", $CTX_MSRC, "move", "conflict.key", "--to", $CTX_MDST)
$ec = $LASTEXITCODE
Assert-ExitCode "move conflict: fails" 1 $ec
Assert-Contains "move conflict: message" "already has" $out

# Move with --force overwrites
$out = Run-Ok @("-c", $CTX_MSRC, "move", "conflict.key", "--to", $CTX_MDST, "-f")
Assert-Contains "move force: success" "Moved" $out

$out = Run-Ok @("-c", $CTX_MDST, "get", "conflict.key")
Assert-Eq "move force: value overwritten" "src-val" $out.Trim()

# Same context should fail
Run-Ok @("-c", $CTX_MSRC, "add", "same.ctx", "-v", "val") | Out-Null
$out = Run-All @("-c", $CTX_MSRC, "move", "same.ctx", "--to", $CTX_MSRC)
$ec = $LASTEXITCODE
Assert-ExitCode "move same ctx: fails" 1 $ec

# JSON output
Run-Ok @("-c", $CTX_MSRC, "add", "json.move", "-v", "jval") | Out-Null
& node $CLI -c $CTX_MDST delete -y json.move 2>$null | Out-Null
$out = Run-Ok @("-c", $CTX_MSRC, "--json", "move", "json.move", "--to", $CTX_MDST)
Assert-Contains "move json: action" '"move"' $out
Assert-Contains "move json: from" $CTX_MSRC $out
Assert-Contains "move json: to" $CTX_MDST $out

# Clean up
Run-Ok @("-c", $CTX_MSRC, "delete", "--all", "-y") | Out-Null
Run-Ok @("-c", $CTX_MDST, "delete", "--all", "-y") | Out-Null

# ─── 19. COPY ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 19. COPY ──"

$CTX_CSRC = "test.e2e-copy-src"
$CTX_CDST = "test.e2e-copy-dst"

# Seed source context
Run-Ok @("-c", $CTX_CSRC, "add", "redis.host", "-v", "localhost") | Out-Null
Run-Ok @("-c", $CTX_CSRC, "add", "redis.port", "-v", "6379") | Out-Null
Run-Ok @("-c", $CTX_CSRC, "add", "redis.password", "-v", "r3d1s") | Out-Null
Run-Ok @("-c", $CTX_CSRC, "add", "api.token", "-v", "tok_copy") | Out-Null

# Copy single key
$out = Run-Ok @("-c", $CTX_CSRC, "copy", "api.token", "--to", $CTX_CDST)
Assert-Contains "copy single: success" "Copied" $out
Assert-Contains "copy single: count" "1 secret" $out

# Verify copied
$out = Run-Ok @("-c", $CTX_CDST, "get", "api.token")
Assert-Eq "copy single: value in target" "tok_copy" $out.Trim()

# Source should still have it (unlike move)
$out = Run-Ok @("-c", $CTX_CSRC, "get", "api.token")
Assert-Eq "copy single: source intact" "tok_copy" $out.Trim()

# Copy with glob pattern (redis.*)
$out = Run-Ok @("-c", $CTX_CSRC, "copy", "redis.*", "--to", $CTX_CDST, "-y")
Assert-Contains "copy glob: success" "Copied" $out
Assert-Contains "copy glob: count" "3 secrets" $out

# Verify all redis keys copied
$out = Run-Ok @("-c", $CTX_CDST, "get", "redis.host")
Assert-Eq "copy glob: redis.host" "localhost" $out.Trim()
$out = Run-Ok @("-c", $CTX_CDST, "get", "redis.password")
Assert-Eq "copy glob: redis.password" "r3d1s" $out.Trim()

# Source still has everything
$out = Run-Ok @("-c", $CTX_CSRC, "list")
Assert-Contains "copy glob: source has redis.host" "redis.host" $out
Assert-Contains "copy glob: source has api.token" "api.token" $out

# Copy with --all
Run-Ok @("-c", $CTX_CDST, "delete", "--all", "-y") | Out-Null
$out = Run-Ok @("-c", $CTX_CSRC, "copy", "--all", "--to", $CTX_CDST, "-y")
Assert-Contains "copy all: success" "Copied" $out
Assert-Contains "copy all: count" "4 secrets" $out

# Conflict detection
$out = Run-All @("-c", $CTX_CSRC, "copy", "api.token", "--to", $CTX_CDST)
$ec = $LASTEXITCODE
Assert-ExitCode "copy conflict: fails" 1 $ec
Assert-Contains "copy conflict: message" "already has" $out

# Copy with --force overwrites
Run-Ok @("-c", $CTX_CSRC, "add", "api.token", "-v", "updated-tok") | Out-Null
$out = Run-Ok @("-c", $CTX_CSRC, "copy", "api.token", "--to", $CTX_CDST, "-f")
Assert-Contains "copy force: success" "Copied" $out

$out = Run-Ok @("-c", $CTX_CDST, "get", "api.token")
Assert-Eq "copy force: value overwritten" "updated-tok" $out.Trim()

# Same context should fail
$out = Run-All @("-c", $CTX_CSRC, "copy", "api.token", "--to", $CTX_CSRC)
$ec = $LASTEXITCODE
Assert-ExitCode "copy same ctx: fails" 1 $ec

# JSON output
& node $CLI -c $CTX_CDST delete -y json.copy 2>$null | Out-Null
Run-Ok @("-c", $CTX_CSRC, "add", "json.copy", "-v", "jval") | Out-Null
$out = Run-Ok @("-c", $CTX_CSRC, "--json", "copy", "json.copy", "--to", $CTX_CDST)
Assert-Contains "copy json: action" '"copy"' $out
Assert-Contains "copy json: from" $CTX_CSRC $out
Assert-Contains "copy json: to" $CTX_CDST $out

# Clean up
Run-Ok @("-c", $CTX_CSRC, "delete", "--all", "-y") | Out-Null
Run-Ok @("-c", $CTX_CDST, "delete", "--all", "-y") | Out-Null

# ─── 20. CLEANUP & VERIFY ────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 20. CLEANUP ──"

foreach ($key in @("db.password", "api.token", "special.emoji", "special.utf8")) {
    Run-Ok @("-c", $CTX, "delete", "-y", $key) | Out-Null
}
foreach ($key in @("redis.host", "redis.port", "redis.password", "smtp.user", "smtp.pass")) {
    Run-Ok @("-c", $CTX2, "delete", "-y", $key) | Out-Null
}

$out = Run-Ok @("-c", $CTX, "list")
Assert-Contains "cleanup: ctx1 empty" "No secrets" $out

$out = Run-Ok @("-c", $CTX2, "list")
Assert-Contains "cleanup: ctx2 empty" "No secrets" $out

# ─── RESULTS ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════"
$Total = $script:PASS + $script:FAIL
if ($script:FAIL -eq 0) {
    Write-Host "  RESULT: $($script:PASS)/$Total tests passed ✓" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $($script:PASS)/$Total passed, $($script:FAIL) failed ✗" -ForegroundColor Red
}
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host ""

} finally {
    Cleanup-Secrets
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

exit $script:FAIL
