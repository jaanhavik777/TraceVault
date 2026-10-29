#!/usr/bin/env bash
# DROPS EVERYTHING in the public schema and rebuilds. Local development only!
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set}"

SQL="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "$SQL"
else
  docker exec -i tracevault-db psql -U tracevault -d tracevault -q -c "$SQL"
fi
bash scripts/setup-db.sh
