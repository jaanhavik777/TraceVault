# 1. Problem statement, objectives and scope

## Problem statement
Modern software systems consist of many interconnected services. They fail for many reasons: application errors, database problems,
configuration changes, deployments, infrastructure faults and external dependencies. Information about these failures usually lives in
isolated records (chat messages, tickets, notes). That makes it hard to see which services were affected, how they depend on each other,
whether a recent deployment is to blame, whether the failure has happened before, and how it was fixed last time.

**TraceVault** is a database-driven incident intelligence platform. It stores incidents, services, service dependencies, deployments,
investigation events and resolutions in a relational database, and uses vector similarity search over incident and resolution text to
retrieve historically similar incidents while an engineer is investigating.

## Objectives
1. Record incidents with severity, status, affected services, reporter and assigned engineer, and manage their lifecycle
   (OPEN, INVESTIGATING, MITIGATED, RESOLVED, CLOSED).
2. Keep a chronological investigation timeline for every incident, recorded automatically by the database itself so that no client can skip it.
3. Model services and their dependencies, so the impact of a failing service can be analysed (including indirect dependents).
4. Correlate incidents with recent deployments of the affected services.
5. Capture resolution knowledge (root cause category, root cause, resolution summary) and make it reusable.
6. Retrieve historically similar incidents by meaning, not by keyword (pgvector similarity search).
7. Provide role-based access for administrators and engineers, with passwords hashed and credentials kept out of source code.
8. Demonstrate sound database design: ER model, normalised schema, constraints, indexes, views, transactions, triggers and stored functions.
9. Provide analytics (open and critical incidents, incidents per service and severity, resolution time, trends) from SQL queries and views.

## Users and roles
| Role | Can do |
|---|---|
| Admin | Manage users, services and service dependencies; view all incidents; assign incidents; view analytics |
| Engineer | Create incidents; view incidents; update and resolve incidents assigned to them; add investigation events; search historical incidents |

## Scope
**In scope:** incident management and lifecycle, investigation timeline, services and dependency management, deployment correlation,
resolution knowledge, semantic search over incident knowledge, analytics dashboard, authentication and authorization, audit logging.

**Out of scope** (deliberately, to keep a realistic two-person scope):
- Machine-learning incident prediction
- Real-time infrastructure monitoring (no Kafka, Prometheus, WebSockets)
- Integration with real cloud infrastructure
- Automated root-cause diagnosis (TraceVault retrieves *historical knowledge*; it does not diagnose production systems)
- Production infrastructure control and a full DevOps platform

## Technology
| Layer | Choice | Why |
|---|---|---|
| Relational database | PostgreSQL 16 | Strong constraints, transactions, triggers, PL/pgSQL functions, views; one engine for structured data and vectors |
| Vector storage | pgvector extension (in the same PostgreSQL) | Incident and resolution text is unstructured; similarity search needs embeddings. Keeping vectors beside the relational rows lets one SQL query join similarity results with incident, severity and resolution data |
| Embeddings | `nomic-embed-text` via local Ollama (768 dimensions) | Free, no API key, incident text never leaves the machine |
| Web application | Next.js (App Router and Route Handlers) with TypeScript | Required by the course; route handlers form the API layer between the UI and the database |
| Authentication | bcrypt password hashes, signed JWT in an HttpOnly cookie | Passwords are never stored in plain text |
