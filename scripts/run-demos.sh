#!/usr/bin/env bash
# Runs the SQL demo files in the right order, pausing after each so you can take a screenshot.
# WARNING: RESETS the database first (drops everything, rebuilds, reloads demo passwords).
# Usage:  bash scripts/run-demos.sh jaanhavi    (07 queries, then 06 transactions/DML)
#         bash scripts/run-demos.sh kushi       (08 queries)
#         bash scripts/run-demos.sh all
set -euo pipefail
cd "$(dirname "$0")/.."
WHO="${1:-all}"
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set (copy .env.example to .env.local)}"

run_file() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -f "$1"
  else
    docker exec -i tracevault-db psql -U tracevault -d tracevault < "$1"
  fi
}
pause() { echo; read -rp ">>> Screenshot now, then press Enter to continue... " _ || true; clear 2>/dev/null || true; }

bash scripts/reset-db.sh >/dev/null
node scripts/make-password-sql.js > sql/local_passwords.sql   # real hashes for every seeded user
run_file sql/local_passwords.sql >/dev/null

OLLAMA_ADDR="${OLLAMA_BASE_URL:-http://localhost:11434}"
if curl -fsS -m 3 -o /dev/null "$OLLAMA_ADDR"; then
  echo "Ollama detected: generating seeded incident embeddings and applying vector index."
  npx --yes tsx scripts/backfill-embeddings.ts
  bash scripts/apply-vector-index.sh
else
  echo "Ollama unavailable: semantic/vector demos are skipped until embeddings are generated."
fi

echo "Database reset. Starting demos for: $WHO"; pause

files=()
case "$WHO" in
  jaanhavi) files=(sql/07_jaanhavi_queries.sql sql/06_jaanhavi_transactions_dml.sql) ;;
  kushi)    files=(sql/08_kushi_queries.sql) ;;
  all)      files=(sql/07_jaanhavi_queries.sql sql/08_kushi_queries.sql sql/06_jaanhavi_transactions_dml.sql) ;;
  *) echo "Unknown option: $WHO"; exit 1 ;;
esac

for f in "${files[@]}"; do
  echo "################ $f"; run_file "$f"; pause
done
echo "Done. Index/vector demos (09) need embeddings first; Kushi runs those separately."
