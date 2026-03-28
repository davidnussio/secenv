#!/usr/bin/env bash
#
# envsec — End-to-End Integration Test
#
# Testa il ciclo completo: add, get, list, search, env-file, load, delete, run, cmd.
# Usa contesti dedicati "test.e2e" / "test.e2e-second" per non interferire con dati reali.
# Alla fine pulisce tutto e verifica che non rimangano segreti orfani.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="$SCRIPT_DIR/../dist/main.js"
CTX="test.e2e"
CTX2="test.e2e-second"
PASS=0
FAIL=0

# ─── Helpers ──────────────────────────────────────────────────────────────────

cleanup_secrets() {
  for key in db.password api.token special.chars stale.secret; do
    node "$CLI" -c "$CTX" delete -y "$key" >/dev/null 2>&1 || true
  done
  for key in redis.host redis.port redis.password smtp.user smtp.pass; do
    node "$CLI" -c "$CTX2" delete -y "$key" >/dev/null 2>&1 || true
  done
  node "$CLI" -c "test.e2e-all" delete --all -y >/dev/null 2>&1 || true
  node "$CLI" -c "test.e2e-expiry" delete --all -y >/dev/null 2>&1 || true
  node "$CLI" cmd delete "test-echo" >/dev/null 2>&1 || true
  node "$CLI" cmd delete "test-multi" >/dev/null 2>&1 || true
}

cleanup_secrets

# Create tmpdir AFTER initial cleanup so it survives
TMPDIR_TEST=$(mktemp -d)
trap 'cleanup_secrets; rm -rf "$TMPDIR_TEST"' EXIT

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    green "  ✓ $name"; ((PASS++))
  else
    red "  ✗ $name"; red "    expected: '$expected'"; red "    actual:   '$actual'"; ((FAIL++))
  fi
}

assert_contains() {
  local name="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    green "  ✓ $name"; ((PASS++))
  else
    red "  ✗ $name"; red "    expected to contain: '$needle'"; red "    got: '$haystack'"; ((FAIL++))
  fi
}

assert_not_contains() {
  local name="$1" needle="$2" haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    green "  ✓ $name"; ((PASS++))
  else
    red "  ✗ $name"; red "    should NOT contain: '$needle'"; ((FAIL++))
  fi
}

assert_exit() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    green "  ✓ $name"; ((PASS++))
  else
    red "  ✗ $name"; red "    expected exit: $expected, got: $actual"; ((FAIL++))
  fi
}

# Cattura solo stdout (stderr va a /dev/null)
run_ok() { node "$CLI" "$@" 2>/dev/null; }

# Cattura stdout+stderr insieme (per verificare messaggi di errore)
run_all() { node "$CLI" "$@" 2>&1; }


echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  envsec — End-to-End Integration Test"
echo "═══════════════════════════════════════════════════════════════"

# ─── 1. ADD & GET ────────────────────────────────────────────────────────────
echo ""
echo "── 1. ADD & GET ──"

out=$(run_ok -c "$CTX" add db.password -v "supersecret123")
assert_contains "add: conferma" "stored" "$out"

out=$(run_ok -c "$CTX" get db.password)
assert_eq "get: valore corretto" "supersecret123" "$out"

run_ok -c "$CTX" add api.token -v "tok_abc_999" >/dev/null
out=$(run_ok -c "$CTX" get api.token)
assert_eq "get: secondo segreto" "tok_abc_999" "$out"

# Sovrascrittura
run_ok -c "$CTX" add db.password -v "newpassword" >/dev/null
out=$(run_ok -c "$CTX" get db.password)
assert_eq "add: sovrascrittura" "newpassword" "$out"

# Caratteri speciali
run_ok -c "$CTX" add special.chars -v 'p@ss w0rd!#$%' >/dev/null
out=$(run_ok -c "$CTX" get special.chars)
assert_eq "get: caratteri speciali" 'p@ss w0rd!#$%' "$out"

# ─── 1b. GET --quiet ──────────────────────────────────────────────────────────
echo ""
echo "── 1b. GET --quiet ──"

out=$(run_ok -c "$CTX" get -q db.password)
assert_eq "get -q: only value" "newpassword" "$out"

out=$(run_ok -c "$CTX" get --quiet api.token)
assert_eq "get --quiet: only value" "tok_abc_999" "$out"

# ─── 2. LIST ─────────────────────────────────────────────────────────────────
echo ""
echo "── 2. LIST ──"

out=$(run_ok -c "$CTX" list)
assert_contains "list: db.password" "db.password" "$out"
assert_contains "list: api.token" "api.token" "$out"
assert_contains "list: special.chars" "special.chars" "$out"
assert_contains "list: summary count" "3 secrets in $CTX" "$out"

out=$(run_ok list)
assert_contains "list contesti: test.e2e" "test.e2e" "$out"

out=$(run_ok -c "$CTX" --json list)
assert_contains "list --json: array" "[" "$out"
assert_contains "list --json: chiave" "db.password" "$out"

# ─── 3. SEARCH ───────────────────────────────────────────────────────────────
echo ""
echo "── 3. SEARCH ──"

out=$(run_ok -c "$CTX" search "db*")
assert_contains "search: db.password" "db.password" "$out"
assert_not_contains "search: no api.token" "api.token" "$out"

out=$(run_ok -c "$CTX" search "*token*")
assert_contains "search wildcard: api.token" "api.token" "$out"

out=$(run_ok search "test*")
assert_contains "search contesti: test.e2e" "test.e2e" "$out"

# ─── 4. ENV-FILE ─────────────────────────────────────────────────────────────
echo ""
echo "── 4. ENV-FILE ──"

ENV_OUT="$TMPDIR_TEST/test.env"
out=$(run_ok -c "$CTX" env-file -o "$ENV_OUT")
assert_contains "env-file: scritto" "Written" "$out"

env_content=$(cat "$ENV_OUT")
assert_contains "env-file: DB_PASSWORD" 'DB_PASSWORD="newpassword"' "$env_content"
assert_contains "env-file: API_TOKEN" 'API_TOKEN="tok_abc_999"' "$env_content"
assert_contains "env-file: quotato" '"' "$env_content"

# ─── 4b. ENV (export to stdout) ──────────────────────────────────────────────
echo ""
echo "── 4b. ENV ──"

# Default (bash) export
out=$(run_ok -c "$CTX" env)
assert_contains "env: bash export db.password" "export DB_PASSWORD=" "$out"
assert_contains "env: bash export api.token" "export API_TOKEN=" "$out"
assert_contains "env: bash value" "newpassword" "$out"

# Explicit --shell bash
out=$(run_ok -c "$CTX" env --shell bash)
assert_contains "env --shell bash: export" "export DB_PASSWORD=" "$out"

# --shell fish
out=$(run_ok -c "$CTX" env --shell fish)
assert_contains "env --shell fish: set -gx" "set -gx DB_PASSWORD" "$out"

# --shell powershell
out=$(run_ok -c "$CTX" env --shell powershell)
assert_contains "env --shell powershell: \$env:" '$env:DB_PASSWORD' "$out"

# --unset (bash)
out=$(run_ok -c "$CTX" env --unset)
assert_contains "env --unset bash: unset" "unset DB_PASSWORD" "$out"
assert_contains "env --unset bash: unset api" "unset API_TOKEN" "$out"

# --unset --shell fish
out=$(run_ok -c "$CTX" env --unset --shell fish)
assert_contains "env --unset fish: set -e" "set -e DB_PASSWORD" "$out"

# --unset --shell powershell
out=$(run_ok -c "$CTX" env --unset --shell powershell)
assert_contains "env --unset powershell: Remove-Item" "Remove-Item" "$out"

# Empty context
ec=0
out=$(run_all -c "nonexistent.ctx.e2e" env 2>&1) || ec=$?
assert_contains "env: empty context message" "No secrets" "$out"

# ─── 5. LOAD ─────────────────────────────────────────────────────────────────
echo ""
echo "── 5. LOAD ──"

LOAD_ENV="$TMPDIR_TEST/load-test.env"
cat > "$LOAD_ENV" << 'ENVEOF'
# Comment — should be ignored
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=r3d1s_s3cr3t

SMTP_USER=mailer@example.com
SMTP_PASS="quoted value with spaces"
ENVEOF

out=$(run_ok -c "$CTX2" load -i "$LOAD_ENV")
assert_contains "load: done" "Done" "$out"
assert_contains "load: added" "added" "$out"

out=$(run_ok -c "$CTX2" get redis.host)
assert_eq "load: redis.host" "localhost" "$out"

out=$(run_ok -c "$CTX2" get redis.port)
assert_eq "load: redis.port" "6379" "$out"

out=$(run_ok -c "$CTX2" get redis.password)
assert_eq "load: redis.password" "r3d1s_s3cr3t" "$out"

out=$(run_ok -c "$CTX2" get smtp.user)
assert_eq "load: smtp.user" "mailer@example.com" "$out"

out=$(run_ok -c "$CTX2" get smtp.pass)
assert_eq "load: smtp.pass (quoted)" "quoted value with spaces" "$out"

# Without --force: should skip duplicates
out=$(run_ok -c "$CTX2" load -i "$LOAD_ENV")
assert_contains "load no-force: skip" "skipped" "$out"

# With --force: should overwrite
out=$(run_ok -c "$CTX2" load -i "$LOAD_ENV" -f)
assert_contains "load --force: overwritten" "overwritten" "$out"

# ─── 6. DELETE ────────────────────────────────────────────────────────────────
echo ""
echo "── 6. DELETE ──"

out=$(run_ok -c "$CTX" delete -y special.chars)
assert_contains "delete: confirmed" "removed" "$out"

# Verify secret no longer exists
ec=0
run_all -c "$CTX" get special.chars >/dev/null || ec=$?
assert_exit "delete: get fails after delete" "1" "$ec"

# Other secrets still intact
out=$(run_ok -c "$CTX" get db.password)
assert_eq "delete: others intact" "newpassword" "$out"

# ─── 6b. DELETE --all ──────────────────────────────────────────────────────────
echo ""
echo "── 6b. DELETE --all ──"

# Seed a temporary context with multiple secrets
CTX_ALL="test.e2e-all"
run_ok -c "$CTX_ALL" add one.key -v "v1" >/dev/null
run_ok -c "$CTX_ALL" add two.key -v "v2" >/dev/null
run_ok -c "$CTX_ALL" add three.key -v "v3" >/dev/null

out=$(run_ok -c "$CTX_ALL" list)
assert_contains "delete --all: seeded one.key" "one.key" "$out"
assert_contains "delete --all: seeded two.key" "two.key" "$out"
assert_contains "delete --all: seeded three.key" "three.key" "$out"

# Delete all with --all -y (skip confirmation)
out=$(run_ok -c "$CTX_ALL" delete --all -y)
assert_contains "delete --all: removed count" "Removed 3" "$out"

# Verify context is empty
out=$(run_ok -c "$CTX_ALL" list || true)
assert_contains "delete --all: context empty" "No secrets" "$out"

# Delete --all on already empty context
out=$(run_ok -c "$CTX_ALL" delete --all -y)
assert_contains "delete --all: empty context" "No secrets" "$out"

# ─── 7. RUN ──────────────────────────────────────────────────────────────────
echo ""
echo "── 7. RUN ──"

out=$(run_ok -c "$CTX" run "echo hello-no-secrets")
assert_contains "run: no secrets" "hello-no-secrets" "$out"

out=$(run_ok -c "$CTX" run "echo {db.password}")
assert_contains "run: interpolation" "newpassword" "$out"

# Missing secret
ec=0
out=$(run_all -c "$CTX" run "echo {nonexistent.key}") || ec=$?
assert_exit "run: missing secret fails" "1" "$ec"
assert_contains "run: missing message" "Missing" "$out"

# ─── 8. CMD ──────────────────────────────────────────────────────────────────
echo ""
echo "── 8. CMD ──"

out=$(run_ok -c "$CTX" run -s -n test-echo "echo {db.password}")
assert_contains "cmd save: executed" "newpassword" "$out"

out=$(run_ok cmd list)
assert_contains "cmd list: test-echo" "test-echo" "$out"

out=$(run_ok cmd run test-echo)
assert_contains "cmd run: executed" "newpassword" "$out"

# cmd run --quiet: suppress informational output
out=$(run_ok cmd run -q test-echo)
assert_contains "cmd run -q: executed" "newpassword" "$out"
assert_not_contains "cmd run -q: no resolved msg" "Resolved" "$out"

out=$(run_ok cmd run --quiet test-echo)
assert_contains "cmd run --quiet: executed" "newpassword" "$out"
assert_not_contains "cmd run --quiet: no resolved msg" "Resolved" "$out"

out=$(run_ok cmd search "test*")
assert_contains "cmd search: test-echo" "test-echo" "$out"

out=$(run_ok cmd delete test-echo)
assert_contains "cmd delete: confirmed" "removed" "$out"

ec=0
run_all cmd run test-echo >/dev/null || ec=$?
assert_exit "cmd delete: run fails after" "1" "$ec"

# ─── 9. ENVSEC_CONTEXT env var ───────────────────────────────────────────────
echo ""
echo "── 9. ENVSEC_CONTEXT ──"

out=$(ENVSEC_CONTEXT="$CTX" run_ok get db.password)
assert_eq "env var: get without -c" "newpassword" "$out"

out=$(ENVSEC_CONTEXT="$CTX" run_ok list)
assert_contains "env var: list without -c" "db.password" "$out"

# ─── 10. ERROR HANDLING ──────────────────────────────────────────────────────
echo ""
echo "── 10. ERRORS ──"

ec=0
run_all get db.password >/dev/null || ec=$?
assert_exit "error: missing context" "1" "$ec"

ec=0
run_ok -c "$CTX" add singlepart -v "test-single" >/dev/null
out=$(run_ok -c "$CTX" get singlepart)
assert_eq "add: single-part key works" "test-single" "$out"
run_ok -c "$CTX" delete -y singlepart >/dev/null

ec=0
run_all -c "$CTX" add "a..b" -v test >/dev/null || ec=$?
assert_exit "error: key with empty parts" "1" "$ec"

ec=0
run_all -c "../../etc" get db.password >/dev/null || ec=$?
assert_exit "error: path traversal context" "1" "$ec"

ec=0
run_all -c "$CTX" load -i /nonexistent/file.env >/dev/null || ec=$?
assert_exit "error: load missing file" "1" "$ec"

# ─── 11. JSON OUTPUT ─────────────────────────────────────────────────────────
echo ""
echo "── 11. JSON ──"

out=$(run_ok -c "$CTX" --json get db.password)
assert_contains "json get: context field" '"context"' "$out"
assert_contains "json get: key field" '"key"' "$out"
assert_contains "json get: value field" '"value"' "$out"

out=$(run_ok --json list)
assert_contains "json list: is array" "[" "$out"

# ─── 12. CUSTOM DATABASE PATH ────────────────────────────────────────────────
echo ""
echo "── 12. CUSTOM DB PATH ──"

CUSTOM_DB="$TMPDIR_TEST/custom-store.sqlite"

# --db flag: add and get with custom database
out=$(run_ok --db "$CUSTOM_DB" -c "$CTX" add db.custom -v "custom-value")
assert_contains "db flag: add" "stored" "$out"

out=$(run_ok --db "$CUSTOM_DB" -c "$CTX" get db.custom)
assert_eq "db flag: get" "custom-value" "$out"

# Custom DB should not see secrets from default DB
out=$(run_ok --db "$CUSTOM_DB" -c "$CTX" list)
assert_contains "db flag: list shows custom secret" "db.custom" "$out"
assert_not_contains "db flag: list no default secrets" "api.token" "$out"

# ENVSEC_DB env var: same behavior
CUSTOM_DB2="$TMPDIR_TEST/custom-store2.sqlite"
out=$(ENVSEC_DB="$CUSTOM_DB2" run_ok -c "$CTX" add db.envvar -v "envvar-value")
assert_contains "ENVSEC_DB: add" "stored" "$out"

out=$(ENVSEC_DB="$CUSTOM_DB2" run_ok -c "$CTX" get db.envvar)
assert_eq "ENVSEC_DB: get" "envvar-value" "$out"

# --db flag takes precedence over ENVSEC_DB
out=$(ENVSEC_DB="$CUSTOM_DB2" run_ok --db "$CUSTOM_DB" -c "$CTX" get db.custom)
assert_eq "db flag precedence over ENVSEC_DB" "custom-value" "$out"

# Verify custom DB file was created
if [[ -f "$CUSTOM_DB" ]]; then
  green "  ✓ db flag: file created"; ((PASS++))
else
  red "  ✗ db flag: file not created at $CUSTOM_DB"; ((FAIL++))
fi

# Clean up custom DB secrets (keychain still has them)
run_ok --db "$CUSTOM_DB" -c "$CTX" delete -y db.custom >/dev/null || true
ENVSEC_DB="$CUSTOM_DB2" run_ok -c "$CTX" delete -y db.envvar >/dev/null || true

# ─── 13. SECRET EXPIRY & AUDIT ───────────────────────────────────────────────
echo ""
echo "── 13. SECRET EXPIRY & AUDIT ──"

CTX_EXP="test.e2e-expiry"

# Add a secret with --expires
out=$(run_ok -c "$CTX_EXP" add exp.short -v "shortlived" --expires 1m)
assert_contains "add --expires: stored" "stored" "$out"
assert_contains "add --expires: expiry note" "expires:" "$out"

# Add a secret with long expiry
out=$(run_ok -c "$CTX_EXP" add exp.long -v "longlived" --expires 1y)
assert_contains "add --expires long: stored" "stored" "$out"

# Add a secret without expiry
run_ok -c "$CTX_EXP" add exp.none -v "noexpiry" >/dev/null

# List should show expiry info for secrets that have it
out=$(run_ok -c "$CTX_EXP" list)
assert_contains "list expiry: exp.short" "exp.short" "$out"
assert_contains "list expiry: expires marker" "expires" "$out"

# Get with JSON should include expires_at
out=$(run_ok -c "$CTX_EXP" --json get exp.short)
assert_contains "get json: expires_at field" '"expires_at"' "$out"

out=$(run_ok -c "$CTX_EXP" --json get exp.none)
assert_contains "get json: null expires_at" "null" "$out"

# Audit within 30d — should find the 1m secret (expires within 30d)
out=$(run_ok -c "$CTX_EXP" audit --within 30d)
assert_contains "audit 30d: finds short" "exp.short" "$out"
assert_not_contains "audit 30d: no long" "exp.long" "$out"

# Audit within 2y — should find both expiring secrets
out=$(run_ok -c "$CTX_EXP" audit --within 2y)
assert_contains "audit 2y: finds short" "exp.short" "$out"
assert_contains "audit 2y: finds long" "exp.long" "$out"

# Audit with no context — all contexts
out=$(run_ok audit --within 2y)
assert_contains "audit all: finds expiry context" "$CTX_EXP" "$out"

# Audit JSON output
out=$(run_ok -c "$CTX_EXP" --json audit --within 2y)
assert_contains "audit json: is array" "[" "$out"
assert_contains "audit json: has key" '"key"' "$out"
assert_contains "audit json: has expired field" '"expired"' "$out"

# Audit with nothing expiring
out=$(run_ok -c "$CTX_EXP" audit --within 0m)
# 0m means only already-expired, and our 1m secret hasn't expired yet
assert_contains "audit 0m: nothing expired" "No secrets" "$out"

# Invalid duration
ec=0
out=$(run_all -c "$CTX_EXP" add exp.bad -v "x" --expires "abc") || ec=$?
assert_exit "add: invalid duration fails" "1" "$ec"

# Update expiry on existing secret
out=$(run_ok -c "$CTX_EXP" add exp.short -v "updated" --expires 7d)
assert_contains "add update expiry: stored" "stored" "$out"

# Clean up expiry context
run_ok -c "$CTX_EXP" delete --all -y >/dev/null || true

# ─── 14. ENV FILE EXPORT TRACKING ────────────────────────────────────────────
echo ""
echo "── 14. ENV FILE EXPORT TRACKING ──"

# Generate an env file — should be tracked
ENV_TRACK_OUT="$TMPDIR_TEST/first-tracked.env"
run_ok -c "$CTX" env-file -o "$ENV_TRACK_OUT" >/dev/null

# Audit should show the generated env file
out=$(run_ok -c "$CTX" audit --within 30d)
assert_contains "audit env-file: shows path" "$ENV_TRACK_OUT" "$out"
assert_contains "audit env-file: section header" "Generated .env files" "$out"

# Generate a second env file with different path
ENV_TRACK_OUT2="$TMPDIR_TEST/second-tracked.env"
run_ok -c "$CTX" env-file -o "$ENV_TRACK_OUT2" >/dev/null

# Audit without context should show all env files
out=$(run_ok audit --within 30d)
assert_contains "audit all env-files: first path" "$ENV_TRACK_OUT" "$out"
assert_contains "audit all env-files: second path" "$ENV_TRACK_OUT2" "$out"

# Audit JSON should include env_files array
out=$(run_ok -c "$CTX" --json audit --within 30d)
assert_contains "audit json: has env_files" '"env_files"' "$out"
assert_contains "audit json: has secrets key" '"secrets"' "$out"
assert_contains "audit json: env file path" "$ENV_TRACK_OUT" "$out"

# Delete a tracked env file and verify audit prunes it
rm -f "$ENV_TRACK_OUT"
out=$(run_ok -c "$CTX" audit --within 30d)
assert_contains "audit prune: stale removed msg" "stale" "$out"
assert_not_contains "audit prune: removed file gone" "$ENV_TRACK_OUT" "$out"
assert_contains "audit prune: existing file still shown" "$ENV_TRACK_OUT2" "$out"

# Second audit should not show stale message (already cleaned)
out=$(run_ok -c "$CTX" audit --within 30d)
assert_not_contains "audit prune: no stale on second run" "stale" "$out"

# ─── 15. SHARE (GPG ENCRYPTION) ───────────────────────────────────────────────
echo ""
echo "── 15. SHARE ──"

# Check if gpg is available
if command -v gpg &>/dev/null; then
  # Generate a temporary GPG key for testing
  GPG_HOME="$TMPDIR_TEST/gnupg"
  mkdir -p "$GPG_HOME"
  chmod 700 "$GPG_HOME"

  cat > "$GPG_HOME/keygen-params" << 'GPGEOF'
%no-protection
Key-Type: RSA
Key-Length: 2048
Subkey-Type: RSA
Subkey-Length: 2048
Name-Real: envsec test
Name-Email: envsec-test@localhost
Expire-Date: 0
%commit
GPGEOF

  GNUPGHOME="$GPG_HOME" gpg --batch --gen-key "$GPG_HOME/keygen-params" 2>/dev/null

  # Seed secrets for share test
  run_ok -c "$CTX" add db.password -v "sharepass123" >/dev/null
  run_ok -c "$CTX" add api.token -v "tok_share_456" >/dev/null

  # Share to stdout (default .env format)
  out=$(GNUPGHOME="$GPG_HOME" run_ok -c "$CTX" share --encrypt-to envsec-test@localhost)
  assert_contains "share: PGP header" "BEGIN PGP MESSAGE" "$out"
  assert_contains "share: PGP footer" "END PGP MESSAGE" "$out"

  # Decrypt and verify content
  decrypted=$(echo "$out" | GNUPGHOME="$GPG_HOME" gpg --batch --decrypt 2>/dev/null)
  assert_contains "share: decrypted has DB_PASSWORD" 'DB_PASSWORD=' "$decrypted"
  assert_contains "share: decrypted has API_TOKEN" 'API_TOKEN=' "$decrypted"

  # Share to file
  SHARE_OUT="$TMPDIR_TEST/shared.enc"
  GNUPGHOME="$GPG_HOME" run_ok -c "$CTX" share --encrypt-to envsec-test@localhost -o "$SHARE_OUT" >/dev/null
  if [[ -f "$SHARE_OUT" ]]; then
    green "  ✓ share -o: file created"; ((PASS++))
  else
    red "  ✗ share -o: file not created"; ((FAIL++))
  fi

  file_content=$(cat "$SHARE_OUT")
  assert_contains "share -o: PGP header in file" "BEGIN PGP MESSAGE" "$file_content"

  # Decrypt file and verify
  decrypted_file=$(GNUPGHOME="$GPG_HOME" gpg --batch --decrypt "$SHARE_OUT" 2>/dev/null)
  assert_contains "share -o: decrypted file has DB_PASSWORD" 'DB_PASSWORD=' "$decrypted_file"

  # Share with --json format
  out=$(GNUPGHOME="$GPG_HOME" run_ok -c "$CTX" --json share --encrypt-to envsec-test@localhost)
  decrypted_json=$(echo "$out" | GNUPGHOME="$GPG_HOME" gpg --batch --decrypt 2>/dev/null)
  assert_contains "share --json: has context" '"context"' "$decrypted_json"
  assert_contains "share --json: has secrets" '"secrets"' "$decrypted_json"

  # Share empty context
  ec=0
  out=$(GNUPGHOME="$GPG_HOME" run_all -c "nonexistent.ctx.e2e" share --encrypt-to envsec-test@localhost 2>&1) || ec=$?
  assert_contains "share: empty context message" "No secrets" "$out"

  # Share with invalid GPG key
  ec=0
  out=$(GNUPGHOME="$GPG_HOME" run_all -c "$CTX" share --encrypt-to nonexistent-key@invalid 2>&1) || ec=$?
  assert_exit "share: invalid GPG key fails" "1" "$ec"

  # Clean up GPG home
  rm -rf "$GPG_HOME"
else
  echo "  ⚠ gpg not found — skipping share tests"
fi

# ─── 16. STALE METADATA (get/delete orphaned secrets) ─────────────────────────
echo ""
echo "── 16. STALE METADATA ──"

CTX_STALE="test.e2e"

# Add a secret normally
run_ok -c "$CTX_STALE" add stale.secret -v "will-be-orphaned" >/dev/null

# Verify it works
out=$(run_ok -c "$CTX_STALE" get stale.secret)
assert_eq "stale: get before removal" "will-be-orphaned" "$out"

# Delete directly from OS keychain (bypass envsec), leaving metadata orphaned
# service = envsec.<context>.<prefix>, account = <last part>
if [[ "$(uname)" == "Darwin" ]]; then
  security delete-generic-password -s "envsec.${CTX_STALE}.stale" -a "secret" >/dev/null 2>&1 || true
else
  secret-tool clear service "envsec.${CTX_STALE}.stale" account "secret" >/dev/null 2>&1 || true
fi

# get should fail with a helpful message suggesting delete
ec=0
out=$(run_all -c "$CTX_STALE" get stale.secret) || ec=$?
assert_exit "stale: get exits with error" "1" "$ec"
assert_contains "stale: get mentions missing from keychain" "missing from the OS keychain" "$out"
assert_contains "stale: get suggests delete command" "envsec delete" "$out"

# get --quiet should also show the suggestion
ec=0
out=$(run_all -c "$CTX_STALE" get -q stale.secret) || ec=$?
assert_exit "stale: get -q exits with error" "1" "$ec"
assert_contains "stale: get -q suggests delete" "envsec delete" "$out"

# list should still show the key (metadata exists)
out=$(run_ok -c "$CTX_STALE" list)
assert_contains "stale: list still shows key" "stale.secret" "$out"

# delete should succeed and clean up the orphaned metadata
out=$(run_ok -c "$CTX_STALE" delete -y stale.secret)
assert_contains "stale: delete succeeds" "removed" "$out"

# After delete, list should no longer show the key
out=$(run_ok -c "$CTX_STALE" list || true)
assert_not_contains "stale: list after cleanup" "stale.secret" "$out"

# get should now fail with standard not found (no metadata either)
ec=0
run_all -c "$CTX_STALE" get stale.secret >/dev/null || ec=$?
assert_exit "stale: get after cleanup fails" "1" "$ec"

# ─── 17. COMPLETIONS ──────────────────────────────────────────────────────────
echo ""
echo "── 17. COMPLETIONS ──"

# __complete contexts should list test.e2e context (we still have secrets)
out=$(node "$CLI" __complete contexts 2>/dev/null)
assert_contains "complete contexts: test.e2e" "$CTX" "$out"

# __complete keys should list keys for the context
out=$(node "$CLI" __complete keys "$CTX" 2>/dev/null)
assert_contains "complete keys: db.password" "db.password" "$out"

# __complete commands should work (may be empty, just check exit code)
ec=0
node "$CLI" __complete commands >/dev/null 2>&1 || ec=$?
assert_exit "complete commands: exit 0" "0" "$ec"

# __complete unknown type should exit silently
ec=0
node "$CLI" __complete unknown >/dev/null 2>&1 || ec=$?
assert_exit "complete unknown: exit 0" "0" "$ec"

# --completions bash should output completion script
out=$(node "$CLI" --completions bash 2>/dev/null)
assert_contains "completions bash: function" "_envsec_completions" "$out"
assert_contains "completions bash: __complete" "__complete" "$out"

# --completions zsh should output completion script
out=$(node "$CLI" --completions zsh 2>/dev/null)
assert_contains "completions zsh: compdef" "#compdef" "$out"
assert_contains "completions zsh: __complete" "__complete" "$out"

# --completions fish should output completion script
out=$(node "$CLI" --completions fish 2>/dev/null)
assert_contains "completions fish: complete" "complete -c envsec" "$out"
assert_contains "completions fish: __complete" "__complete" "$out"

# ─── 18. CLEANUP & VERIFY ────────────────────────────────────────────────────
echo ""
echo "── 18. CLEANUP ──"

for key in db.password api.token; do
  run_ok -c "$CTX" delete -y "$key" >/dev/null || true
done
for key in redis.host redis.port redis.password smtp.user smtp.pass; do
  run_ok -c "$CTX2" delete -y "$key" >/dev/null || true
done

out=$(run_ok -c "$CTX" list || true)
assert_contains "cleanup: ctx1 empty" "No secrets" "$out"

out=$(run_ok -c "$CTX2" list || true)
assert_contains "cleanup: ctx2 empty" "No secrets" "$out"

# Check no envsec node processes are lingering (exclude biome/IDE processes)
ps_out=$(ps aux 2>/dev/null | grep "node.*dist/main.js" | grep -v grep || true)
if [[ -z "$ps_out" ]]; then
  green "  ✓ cleanup: no pending envsec processes"; ((PASS++))
else
  red "  ✗ cleanup: envsec processes still running"; red "    $ps_out"; ((FAIL++))
fi

# ─── RESULTS ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
  green "  RESULT: $PASS/$TOTAL tests passed ✓"
else
  red "  RESULT: $PASS/$TOTAL passed, $FAIL failed ✗"
fi
echo "═══════════════════════════════════════════════════════════════"
echo ""

exit "$FAIL"
