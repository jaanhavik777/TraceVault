#!/usr/bin/env bash
# Restores the clean demo state: schema + seed data, real demo passwords, embeddings for the seeded incidents.
# Run it after the automated tests (they leave test data behind) and before a demo or before taking screenshots.
# Usage: npm run demo:reset
set -uo pipefail
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set (copy .env.example to .env.local)}"

run_sql_stdin() {
  if command -v psql >/dev/null 2>&1; then psql "$DATABASE_URL" -q
  else docker exec -i tracevault-db psql -U tracevault -d tracevault -q; fi
}

echo ">> Resetting the database"
bash scripts/reset-db.sh >/dev/null 2>&1 || { echo "Database reset failed (is Docker running?)"; exit 1; }
echo ">> Loading demo passwords (Password@123)"
node scripts/make-password-sql.js | run_sql_stdin >/dev/null
OLLAMA_ADDR="${OLLAMA_BASE_URL:-${OLLAMA_URL:-http://localhost:11434}}"
if curl -s -m 3 -o /dev/null "$OLLAMA_ADDR"; then
  echo ">> Indexing the seeded incidents for semantic search"
  npx --yes tsx scripts/backfill-embeddings.ts 2>&1 | grep -E "Total|Successful|Failed"
else
  echo ">> Ollama is not running: skipped indexing. Start Ollama, then run: npx tsx scripts/backfill-embeddings.ts"
fi
echo "Done. Log in with admin@tracevault.io / Password@123"
