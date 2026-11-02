# TraceVault: Incident Causality and Resolution Intelligence Platform

TraceVault is a database-driven incident intelligence platform designed to help engineering teams investigate, track, and resolve incidents while retaining historical resolution knowledge.

It stores incidents, services, service dependencies, deployments, investigation timelines, and resolutions in **PostgreSQL**. It also uses **pgvector** and locally generated embeddings to enable semantic search across historical incidents, helping engineers identify similar incidents and reuse previously established solutions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React, TypeScript |
| Backend / API | Next.js App Router, Route Handlers |
| Database | PostgreSQL 16 |
| Vector Search | pgvector |
| Authentication | bcrypt, JWT session cookies (jose) |
| Embeddings | Ollama, `nomic-embed-text` |
| Development | Node.js, Docker, npm |

## Advanced Database Features

TraceVault demonstrates the use of advanced database concepts:

- **Transactions:** Atomic incident assignment and resolution workflows, including commit and rollback handling.
- **Triggers:** Automatic timeline event creation, status-change auditing, and timestamp updates.
- **Stored Functions:** Database-level incident assignment and resolution logic.
- **Views:** Aggregated incident and service-level information for dashboards and analytics.
- **Indexing:** B-tree indexes for relational queries and IVFFlat indexing for vector similarity search.
- **Vector Similarity Search:** Semantic retrieval of historical incidents using pgvector and cosine distance.

## Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop or Docker Engine
- PostgreSQL 16 with pgvector (if using a local PostgreSQL installation instead of Docker)
- Ollama (optional, required for semantic search)
- `psql` is optional; database scripts can fall back to Docker where supported.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/jaanhavik777/TraceVault.git
cd TraceVault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL

Start the PostgreSQL and pgvector database container:

```bash
docker compose up -d
```

Ensure that the database container is running before proceeding.

### 4. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure the required values in `.env.local`.

At minimum, set a secure `AUTH_SECRET`. Generate one using:

```bash
openssl rand -base64 32
```

Configure the database connection and embedding settings according to `.env.example`.

The Ollama timeout can be configured using:

```env
OLLAMA_TIMEOUT_MS=30000
```

The default timeout is 30 seconds.

**Important:** Never commit `.env`, `.env.local`, or other files containing credentials or secrets.

### 5. Initialize the database

Build the database schema and load the seed data:

```bash
npm run db:setup
```

This initializes the tables, relationships, constraints, triggers, functions, views, and seed records required by the application.

### 6. Configure semantic search (optional)

Semantic search uses Ollama to generate embeddings locally.

Install Ollama from:

https://ollama.com/download

Pull the embedding model:

```bash
ollama pull nomic-embed-text
```

Ensure Ollama is running, then generate embeddings for the seeded incidents:

```bash
npm run embeddings:backfill
```

Create or verify the vector similarity index:

```bash
npm run db:vector-index
```

The vector index is created after embeddings have been populated. The setup is idempotent and can be run again safely.

**Semantic search behavior:**
- When Ollama is available, incident descriptions and resolution information can be embedded and searched semantically.
- Historical incidents are indexed through the embedding backfill script.
- Newly created or resolved incidents attempt to update their embeddings automatically.
- Embedding failures do not prevent incident creation or resolution.
- If Ollama is unavailable or returns an invalid embedding, semantic-search endpoints return HTTP `503 Service Unavailable` with an explanatory error message instead of silently returning empty results.

Ollama is optional for the rest of the application. Authentication, incident management, timelines, and resolution workflows can continue to operate without it.

### 7. Start the application

```bash
npm run dev
```

Open the application at:

http://localhost:3000

Health-check endpoint:

http://localhost:3000/api/health

## Database and Maintenance Commands

| Command | Description |
|---|---|
| `npm run db:setup` | Initialize the schema and seed data |
| `npm run db:reset` | Rebuild the database schema and seed data |
| `npm run demo:reset` | Reset the database and restore demo data and passwords |
| `npm run embeddings:backfill` | Generate embeddings for incidents that need indexing |
| `npm run db:vector-index` | Create or verify the IVFFlat vector index |

**Warning:** `npm run db:reset` and `npm run demo:reset` are destructive operations. They drop and recreate database objects and can delete existing local database data. Use them only in a development or demo environment.

To refresh semantic-search data without resetting the database:

```bash
npm run embeddings:backfill
npm run db:vector-index
```

## Testing

TraceVault includes automated database and API tests.

Run the complete test suite:

```bash
npm run test:all
```

The test runner:
1. Resets the database and loads the demo data.
2. Executes database tests covering schema constraints, indexes, triggers, functions, transactions, and relationships.
3. Backfills embeddings when Ollama is available.
4. Creates or verifies the vector index after a successful backfill.
5. Starts the application and executes API tests covering authentication, authorization, incident workflows, timeline operations, and semantic search.
6. Writes the latest test results to `docs/test-results.md`.

**Important:** `npm run test:all` resets the database. Do not run it against a database containing data you need to preserve.

Additional verification commands:

```bash
npm run typecheck
npm run build
```

## Project Structure

```text
TraceVault/
│
├── app/                    # Next.js pages and API route handlers
│   ├── api/                # Authentication, incidents, search, dashboard APIs
│   ├── dashboard/          # Dashboard page
│   ├── incidents/          # Incident listing and detail pages
│   ├── login/              # Login page
│   └── search/             # Semantic search page
│
├── components/             # Reusable UI components
│   ├── incident/           # Incident-related components
│   ├── panels/             # Dashboard and information panels
│   └── charts/             # Visualization components
│
├── lib/                    # Database, authentication, and embedding logic
│
├── sql/                    # Numbered database schema and feature scripts
│
├── scripts/                # Database setup, reset, testing, and indexing scripts
│
├── tests/                  # Database and API test suites
│
├── docs/                   # Project documentation, test results, screenshots
│
├── API.md                  # API contracts
├── CONTRIBUTING.md         # Contribution guidelines
├── README.md
└── package.json
```

For details about the database scripts and their execution order, refer to `sql/README.md`.

## User Roles

### Admin
- View all incidents.
- Manage users and their roles.
- Manage services and service dependencies.
- Access dashboard analytics and incident information.
- Assign incidents to engineers.

### Engineer
- Create and investigate incidents.
- Update incident status.
- Add investigation timeline events.
- Record root causes and resolutions.
- Search historical incidents using semantic similarity.
- View related services, deployments, and incident context.

## Team Responsibilities

| Jaanhavi | Kushi |
|---|---|
| Authentication and authorization | Services and dependencies |
| Incident management and timeline | Deployment correlation |
| Resolution knowledge | Semantic search and embeddings |
| Transactions, triggers, stored functions | Views, indexing, and vector search |
| Login, incidents, and incident detail pages | Dashboard, search, admin, and incident panels |

## Security

- Passwords are hashed using bcrypt and are never stored in plain text.
- Authentication uses signed JWT session cookies.
- Session cookies are configured with appropriate security attributes, including `HttpOnly`.
- Credentials and secrets are loaded through environment variables.
- `.env` and `.env.local` are excluded from version control.
- Database operations use parameterized queries to protect against SQL injection.
- Role-based authorization restricts access to protected pages and API operations.
- Ollama runs locally for embedding generation, avoiding the need to send incident text to an external embedding API.

## Documentation

Additional project documentation is available in the `docs/` directory.

| Document | Description |
|---|---|
| `API.md` | API contracts and endpoint information |
| `CONTRIBUTING.md` | Contribution guidelines |
| `sql/README.md` | Database setup and SQL execution order |
| `docs/` | Requirements, design, database documentation, and screenshots |
| `docs/test-results.md` | Latest automated test results |
| `docs/vector-search.md` | Semantic search and embedding implementation |
| `docs/09-testing.md` | Testing methodology and test documentation |

---

**TraceVault — Turning incident history into actionable engineering intelligence.**
