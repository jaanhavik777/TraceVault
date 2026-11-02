#!/usr/bin/env bash
# Create the pgvector IVFFlat index after incident embeddings have been loaded.
# Safe to rerun. Does not reset or modify incident data.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set (copy .env.example to .env.local)}"

if command -v psql >/dev/null 2>&1; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
else
  PSQL=(docker exec -i tracevault-db psql -U tracevault -d tracevault -v ON_ERROR_STOP=1 -q)
fi

COUNT="$("${PSQL[@]}" -Atc "SELECT COUNT(*) FROM incident_embeddings;")"
if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "Could not determine the number of incident embeddings." >&2
  exit 1
fi

if [ "$COUNT" -eq 0 ]; then
  echo "No incident embeddings exist yet. Run the Ollama backfill first; vector index creation skipped."
  exit 0
fi

echo "Creating/verifying IVFFlat vector index for $COUNT embeddings..."
"${PSQL[@]}" -c "
  CREATE INDEX IF NOT EXISTS idx_incident_embeddings_vector
  ON incident_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
  ANALYZE incident_embeddings;
"
echo "Vector index is ready."
