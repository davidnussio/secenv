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
    foreach ($key in @("db.password", "api.token", "special.chars")) {
        & node $CLI -c $CTX delete -y $key 2>$null | Out-Null
    }
    foreach ($key in @("redis.host", "redis.port", "redis.password", "smtp.user", "smtp.pass")) {
        & node $CLI -c $CTX2 delete -y $key 2>$null | Out-Null
    }
    & node $CLI -c "test.e2e-all" delete --all -y 2>$null | Out-Null
    & node $CLI -c "test.e2e-expiry" delete --all -y 2>$null | Out-Null
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

# Special characters
Run-Ok @("-c", $CTX, "add", "special.chars", "-v", 'p@ss w0rd!#$%') | Out-Null
$out = Run-Ok @("-c", $CTX, "get", "special.chars")
Assert-Eq "get: caratteri speciali" 'p@ss w0rd!#$%' $out.Trim()

# ─── 2. LIST ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 2. LIST ──"

$out = Run-Ok @("-c", $CTX, "list")
Assert-Contains "list: db.password" "db.password" $out
Assert-Contains "list: api.token" "api.token" $out
Assert-Contains "list: special.chars" "special.chars" $out
Assert-Contains "list: summary count" "3 secrets in $CTX" $out

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

& node $CLI -c $CTX add singlepart -v test 2>$null | Out-Null
Assert-ExitCode "error: key without dot" 1 $LASTEXITCODE

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

# ─── 14. SHARE (GPG ENCRYPTION) ───────────────────────────────────────────────
Write-Host ""
Write-Host "── 14. SHARE ──"

$gpgPath = Get-Command gpg -ErrorAction SilentlyContinue
if ($gpgPath) {
    $GpgHome = Join-Path $TmpDir "gnupg"
    New-Item -ItemType Directory -Path $GpgHome -Force | Out-Null

    $keygenParams = @"
%no-protection
Key-Type: RSA
Key-Length: 2048
Subkey-Type: RSA
Subkey-Length: 2048
Name-Real: envsec test
Name-Email: envsec-test@localhost
Expire-Date: 0
%commit
"@
    $keygenFile = Join-Path $GpgHome "keygen-params"
    $keygenParams | Set-Content -Path $keygenFile -Encoding UTF8

    $env:GNUPGHOME = $GpgHome
    & gpg --batch --gen-key $keygenFile 2>$null

    # Seed secrets for share test
    Run-Ok @("-c", $CTX, "add", "db.password", "-v", "sharepass123") | Out-Null
    Run-Ok @("-c", $CTX, "add", "api.token", "-v", "tok_share_456") | Out-Null

    $out = Run-Ok @("-c", $CTX, "share", "--encrypt-to", "envsec-test@localhost")
    Assert-Contains "share: PGP header" "BEGIN PGP MESSAGE" $out
    Assert-Contains "share: PGP footer" "END PGP MESSAGE" $out

    $decrypted = $out | & gpg --batch --decrypt 2>$null
    $decrypted = $decrypted -join "`n"
    Assert-Contains "share: decrypted has DB_PASSWORD" "DB_PASSWORD=" $decrypted
    Assert-Contains "share: decrypted has API_TOKEN" "API_TOKEN=" $decrypted

    $ShareOut = Join-Path $TmpDir "shared.enc"
    Run-Ok @("-c", $CTX, "share", "--encrypt-to", "envsec-test@localhost", "-o", $ShareOut) | Out-Null
    if (Test-Path $ShareOut) {
        Green "share -o: file created"; $script:PASS++
    } else {
        Red "share -o: file not created"; $script:FAIL++
    }

    $fileContent = Get-Content $ShareOut -Raw
    Assert-Contains "share -o: PGP header in file" "BEGIN PGP MESSAGE" $fileContent

    $decryptedFile = & gpg --batch --decrypt $ShareOut 2>$null
    $decryptedFile = $decryptedFile -join "`n"
    Assert-Contains "share -o: decrypted file has DB_PASSWORD" "DB_PASSWORD=" $decryptedFile

    $out = Run-Ok @("-c", $CTX, "--json", "share", "--encrypt-to", "envsec-test@localhost")
    $decryptedJson = $out | & gpg --batch --decrypt 2>$null
    $decryptedJson = $decryptedJson -join "`n"
    Assert-Contains "share --json: has context" '"context"' $decryptedJson
    Assert-Contains "share --json: has secrets" '"secrets"' $decryptedJson

    $out = Run-All @("-c", "nonexistent.ctx.e2e", "share", "--encrypt-to", "envsec-test@localhost")
    Assert-Contains "share: empty context message" "No secrets" $out

    & node $CLI -c $CTX share --encrypt-to nonexistent-key@invalid 2>$null | Out-Null
    Assert-ExitCode "share: invalid GPG key fails" 1 $LASTEXITCODE

    $env:GNUPGHOME = $null
    Remove-Item -Recurse -Force $GpgHome -ErrorAction SilentlyContinue
} else {
    Write-Host "  ⚠ gpg not found — skipping share tests" -ForegroundColor Yellow
}

# ─── 15. CLEANUP & VERIFY ────────────────────────────────────────────────────
Write-Host ""
Write-Host "── 15. CLEANUP ──"

foreach ($key in @("db.password", "api.token")) {
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
