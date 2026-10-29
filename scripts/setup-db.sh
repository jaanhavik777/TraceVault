#!/usr/bin/env bash
# Builds the TraceVault database: schema, base seed, triggers/functions, views, incident seed.
# Usage: npm run db:setup      (reads DATABASE_URL from .env.local)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set (copy .env.example to .env.local)}"

run_sql() {
  echo ">> $1"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"
  else
    # fall back to the docker container from docker-compose.yml
    docker exec -i tracevault-db psql -U tracevault -d tracevault -v ON_ERROR_STOP=1 -q < "$1"
  fi
}

# ORDER MATTERS: triggers must exist before incidents are seeded.
for f in \
  sql/01_ddl.sql \
  sql/02_seed_base.sql \
  sql/03_jaanhavi_triggers_functions.sql \
  sql/04_kushi_views.sql \
  sql/05_jaanhavi_seed_incidents.sql
do
  run_sql "$f"
done

echo "Database ready. Demo/query files (06-09) are run manually for screenshots."
