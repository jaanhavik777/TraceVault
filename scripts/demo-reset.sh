#!/usr/bin/env bash
# Restores a clean demo database, loads demo passwords, embeddings and the vector index.
# WARNING: this resets the public schema and deletes all local database data.
# Usage: npm run demo:reset
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set (copy .env.example to .env.local)}"

run_sql_stdin() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
  else
    docker exec -i tracevault-db psql -U tracevault -d tracevault -v ON_ERROR_STOP=1 -q
  fi
}

echo ">> Resetting the database (all existing local data will be deleted)"
bash scripts/reset-db.sh >/dev/null

echo ">> Loading demo passwords (Password@123)"
node scripts/make-password-sql.js | run_sql_stdin

OLLAMA_ADDR="${OLLAMA_BASE_URL:-http://localhost:11434}"
if curl -fsS -m 3 -o /dev/null "$OLLAMA_ADDR"; then
  echo ">> Indexing seeded incidents with Ollama"
  npx --yes tsx scripts/backfill-embeddings.ts
  echo ">> Applying the pgvector IVFFlat index"
  bash scripts/apply-vector-index.sh
else
  echo ">> Ollama is unavailable: skipped embedding backfill and vector index."
  echo "   Start Ollama, run 'ollama pull ${EMBEDDING_MODEL:-nomic-embed-text}',"
  echo "   then run 'npm run embeddings:backfill' and 'npm run db:vector-index'."
fi

echo "Done. Log in with admin@tracevault.io / Password@123"
