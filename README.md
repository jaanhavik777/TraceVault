# TraceVault: Incident Causality and Resolution Intelligence Platform

A database-driven incident intelligence platform. It stores incidents, services, service dependencies, deployments, investigation timelines and resolutions in **PostgreSQL**, and uses **pgvector** for semantic search over historical incidents.

## Tech stack
- Frontend and API: Next.js (App Router, Route Handlers), TypeScript
- Database: PostgreSQL 16 + pgvector
- Auth: bcrypt password hashing, JWT session cookie (jose)

## Advanced database features
Transactions, Triggers, Stored Functions, Views, Indexing, Vector Similarity Search

## Prerequisites
- Node.js 20+
- Docker (easiest) **or** a local PostgreSQL 16 with the pgvector extension installed
- `psql` is optional (the setup script falls back to Docker)

## Setup

```bash
# 1. clone and install
git clone <repo-url> tracevault
cd tracevault
npm install

# 2. start the database (PostgreSQL + pgvector)
docker compose up -d

# 3. configure environment
cp .env.example .env.local
# edit .env.local: set AUTH_SECRET (openssl rand -base64 32) and embedding settings

# 4. build the schema and seed data
npm run db:setup

# 5. (Optional, for semantic search) install Ollama and the embedding model
#    https://ollama.com/download
ollama pull nomic-embed-text
npm run embeddings:backfill
npm run db:vector-index

# 6. run the app
npm run dev
# open http://localhost:3000   (health check: http://localhost:3000/api/health)
```

Semantic search requires Ollama running locally with `nomic-embed-text`. If Ollama is unavailable, search endpoints return HTTP 503 with a helpful message; incident creation and resolution continue to work.

To rebuild the local database and demo accounts, run `npm run demo:reset` (destructive: drops and recreates the public schema). To backfill embeddings and create the vector index without resetting data, run `npm run embeddings:backfill` followed by `npm run db:vector-index`.

To wipe and rebuild only the database schema and seed data: `npm run db:reset` (development only).

## Project structure
```
app/            Next.js pages and API route handlers
components/     UI components (incident/, panels/, charts/)
lib/            db pool, auth, embeddings
sql/            numbered SQL files (see sql/README.md)
scripts/        database setup scripts
docs/           report material and screenshots
API.md          API contracts between the two of us
```

## Roles
- **Admin:** manage users, services, dependencies; view all incidents and analytics
- **Engineer:** create/update incidents, add events, record resolutions, search history

## Team responsibilities
| Jaanhavi | Kushi |
|---|---|
| Auth and authorization | Services and dependencies |
| Incident management and timeline | Deployment correlation |
| Resolution knowledge | Semantic search (embeddings) |
| Transactions, triggers, stored functions | Views, indexing, vector search |
| Pages: login, incidents, incident detail | Pages: dashboard, search, admin, incident panels |

## Security
- Passwords are hashed with bcrypt; never stored in plain text
- Credentials come from environment variables; `.env.local` is git-ignored
- Parameterized queries only (no string-built SQL)

## Documentation
See `docs/` and `API.md`. Contribution rules: `CONTRIBUTING.md`.
