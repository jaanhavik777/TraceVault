# API Contracts

Agreed in Phase 0 so both of us can build in parallel. If you change a shape, update this file in the same PR and tell your partner.

All routes (except `/api/auth/login` and `/api/health`) require a valid session cookie. Errors use `{ "error": "message" }` with an appropriate HTTP status (401 not logged in, 403 wrong role, 400 validation).

## Jaanhavi

| Method | Route | Role | Notes |
|---|---|---|---|
| POST | /api/auth/login | public | body `{ email, password }` -> sets cookie, returns `{ userId, role, fullName }` |
| POST | /api/auth/logout | any | clears cookie |
| GET | /api/auth/me | any | returns `{ userId, role, fullName, email }` |
| GET | /api/incidents | any | query: `status`, `severity`, `serviceId`, `from`, `to` (YYYY-MM-DD), `assignedTo=me` |
| POST | /api/incidents | ENGINEER | body `{ title, description, severityId, serviceIds[], primaryServiceId }`; calls `upsertIncidentEmbedding` |
| GET | /api/incidents/[id] | any | incident + events + resolution |
| PATCH | /api/incidents/[id] | ENGINEER (assigned) | body `{ status }`; see transitions below |
| GET | /api/lookups | any | statuses, severities, services, engineers, rootCauseCategories, eventTypes for dropdowns |
| POST | /api/incidents/[id]/assign | ADMIN/ENGINEER | calls `assign_incident()` |
| POST | /api/incidents/[id]/events | ENGINEER | body `{ eventType, description }` |
| POST | /api/incidents/[id]/resolve | ENGINEER | calls `resolve_incident()`, then `upsertIncidentEmbedding` |

## Kushi

| Method | Route | Role | Notes |
|---|---|---|---|
| GET/POST/PATCH/DELETE | /api/services | ADMIN (GET: any) | service CRUD |
| GET/POST/DELETE | /api/dependencies | ADMIN (GET: any) | body `{ serviceId, dependsOnServiceId }` |
| GET/POST/PATCH | /api/users | ADMIN | user management |
| GET/POST | /api/deployments | any / ENGINEER | filter by `serviceId` |
| GET | /api/dashboard | ADMIN | see shape below |
| GET | /api/search?q=&limit=5&resolvedOnly=1 | any | semantic search over incidents + resolutions (pgvector); 503 if Ollama is unavailable |
| GET | /api/incidents/[id]/similar?limit=5 | any | historical incidents most similar to this one (excludes itself) |
| POST | /api/embeddings/backfill[?all=1] | ADMIN | builds embeddings for incidents that have none (all=1 rebuilds every one) |
| GET | /api/incidents/[id]/context | any | see shape below |

## Response shapes (Kushi's endpoints that Jaanhavi's pages consume)

`GET /api/incidents/[id]/similar`
```json
[{ "incident_id": 821, "title": "...", "status": "RESOLVED", "severity": "CRITICAL", "similarity_pct": 94.2,
   "root_cause": "...", "root_cause_category": "DATABASE", "resolution": "..." }]
```

`GET /api/incidents/[id]/context`
```json
{
  "deployments": [{ "deployment_id": 3, "version": "v4.8.0", "deployed_at": "ISO", "hours_before_incident": 1.5, "status": "ROLLED_BACK" }],
  "dependencies": {
    "upstream":   [{ "service_id": 6, "service_name": "Database Cluster" }],
    "downstream": [{ "service_id": 2, "service_name": "Order Service" }]
  }
}
```

`GET /api/dashboard`
```json
{
  "kpis": { "open": 18, "critical": 3, "resolved": 147, "avg_resolution_min": 82 },
  "byService": [{ "service_name": "Payment", "incident_count": 27, "critical_count": 8 }],
  "bySeverity": [{ "severity": "CRITICAL", "count": 3 }],
  "trend": [{ "week_start": "2026-10-19", "incidents": 5 }]
}
```

## Shared function contract

`lib/embeddings.ts -> upsertIncidentEmbedding(incidentId: number): Promise<boolean>`
Safe to call repeatedly, never throws (incident creation must not fail because of search).

## Auth helper usage (lib/auth.ts)

```ts
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ["ADMIN"]);   // throws AuthError 401 / 403
    // ... validate with zod, query the DB ...
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);                              // AuthError -> 401/403, ZodError -> 400, else 500
  }
}
```
Session cookie: `tv_session` (httpOnly JWT, 8 hours). `GET /api/auth/me` returns the current user.
Pages `/admin` and `/dashboard` are admin-only (enforced in `middleware.ts`).

## Incident API details (Jaanhavi)

`GET /api/incidents` returns an array of
`{ incident_id, title, status, severity, created_at, updated_at, reporter_name, assigned_engineer_id, assigned_name, primary_service }`.

`GET /api/incidents/[id]` returns `{ incident, services, events, resolution }`:
- `incident`: `{ incident_id, title, description, priority_score, status, severity, created_at, updated_at, reporter_id, reporter_name, assigned_engineer_id, assigned_name }`
- `services`: `[{ service_id, service_name, criticality, is_primary }]`
- `events`: `[{ event_id, event_type, event_description, event_timestamp, user_id, user_name }]` (oldest first)
- `resolution`: `null` or `{ resolution_id, root_cause_category, root_cause_description, resolution_summary, resolved_at, resolved_by, resolved_by_name }`

Allowed manual status changes (PATCH): `OPEN -> INVESTIGATING`, `INVESTIGATING -> MITIGATED | OPEN`, `MITIGATED -> INVESTIGATING`, `RESOLVED -> CLOSED`.
`RESOLVED` is only set by `POST /api/incidents/[id]/resolve`.
Engineers can change or resolve only incidents assigned to them. Admins are read-only on incidents but may assign.

Event types: `NOTE, HYPOTHESIS, ACTION, MITIGATION, ROLLBACK`.
Root cause categories: `DATABASE, DEPLOYMENT, CONFIGURATION, INFRASTRUCTURE, NETWORK, CAPACITY, QUEUE, EXTERNAL_DEPENDENCY, APPLICATION_BUG, OTHER`.

`handleError()` (lib/auth.ts) now also maps PostgreSQL errors for every route: unique violation -> 409, foreign key -> 400, CHECK -> 400,
NOT NULL -> 400, `RAISE EXCEPTION` from our functions -> 400. It also understands `HttpError(status, message)`.

## Embeddings (Kushi)

Model `nomic-embed-text` through a local Ollama (`OLLAMA_URL`, default http://localhost:11434), 768 dimensions, cosine similarity, HNSW index.
`upsertIncidentEmbedding(id)` runs after every incident create and resolve and never throws. If Ollama is down the search endpoints return
`503 { "error": "..." }` with a message saying what to start or install; everything else keeps working.
