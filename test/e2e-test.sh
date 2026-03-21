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
  for key in db.password api.token special.chars; do
    node "$CLI" -c "$CTX" delete -y "$key" >/dev/null 2>&1 || true
  done
  for key in redis.host redis.port redis.password smtp.user smtp.pass; do
    node "$CLI" -c "$CTX2" delete -y "$key" >/dev/null 2>&1 || true
  done
  node "$CLI" -c "test.e2e-all" delete --all -y >/dev/null 2>&1 || true
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

# ─── 2. LIST ─────────────────────────────────────────────────────────────────
echo ""
echo "── 2. LIST ──"

out=$(run_ok -c "$CTX" list)
assert_contains "list: db.password" "db.password" "$out"
assert_contains "list: api.token" "api.token" "$out"
assert_contains "list: special.chars" "special.chars" "$out"

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
run_all -c "$CTX" add singlepart -v test >/dev/null || ec=$?
assert_exit "error: key without dot" "1" "$ec"

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

# ─── 12. CLEANUP & VERIFY ────────────────────────────────────────────────────
echo ""
echo "── 12. CLEANUP ──"

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
