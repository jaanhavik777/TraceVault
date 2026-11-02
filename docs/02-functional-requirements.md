# 2. Functional and non-functional requirements

"Verified by" lists automated test IDs from `docs/test-results.md` (T-DB, T-AUTH, T-INC, T-WF, T-SRCH) or manual UI cases from
`docs/09-testing.md` (T-UI).

## Functional requirements

| ID | Requirement | Role | Where it is implemented | Verified by |
|---|---|---|---|---|
| FR-01 | A user logs in with email and password; passwords are stored as bcrypt hashes; the session is a signed token in an HttpOnly cookie that expires after 8 hours | All | `/login`, `/api/auth/login`, `lib/auth.ts`, `lib/session.ts` | T-AUTH-01 to 06 |
| FR-02 | Access is role-based: pages and APIs are protected by the session and the user's role | All | `middleware.ts`, `requireRole()` | T-AUTH-08, 09, 11 to 13; T-INC-09; T-WF-06, 07, 15 |
| FR-03 | A user can log out | All | `/api/auth/logout` | T-AUTH-10 |
| FR-04 | An engineer creates an incident with title, description, severity and one or more affected services (one primary); it starts as OPEN and records the reporter | Engineer | `POST /api/incidents`, New incident form | T-INC-09 to 15 |
| FR-05 | Incidents can be listed and filtered by status, severity, service, date range and "assigned to me" | All | `GET /api/incidents`, `/incidents` | T-INC-01 to 08 |
| FR-06 | An incident page shows its details, affected services, timeline and resolution | All | `GET /api/incidents/[id]`, `/incidents/[id]` | T-INC-16, 18, 19 |
| FR-07 | An incident is assigned to an active engineer. The first assignment moves OPEN to INVESTIGATING. Engineers may only assign unassigned incidents or their own; admins may assign any open incident | Admin, Engineer | `assign_incident()`, `POST /api/incidents/[id]/assign` | T-DB-25 to 28; T-WF-01 to 05, 22 to 25 |
| FR-08 | The status follows allowed transitions (OPEN to INVESTIGATING to MITIGATED, back-steps allowed, RESOLVED to CLOSED). Only the assigned engineer changes it | Engineer | `PATCH /api/incidents/[id]`, `TRANSITIONS` in `lib/incidents.ts` | T-WF-06 to 10, 21 |
| FR-09 | Every incident has a chronological timeline. Creation, assignment and status changes are recorded by the database itself; engineers add notes, hypotheses, actions, mitigations and rollbacks | Engineer | triggers, `POST /api/incidents/[id]/events` | T-DB-21 to 24; T-WF-05, 11 to 15 |
| FR-10 | The timeline and assignment of a resolved or closed incident are frozen | All | events and assign routes | T-WF-25, 26 |
| FR-11 | The assigned engineer records a resolution (root cause category, root cause, resolution summary) exactly once; this sets the status to RESOLVED | Engineer | `resolve_incident()`, `POST /api/incidents/[id]/resolve` | T-DB-16, 29; T-WF-16 to 20 |
| FR-12 | Assignments, status changes and resolutions are written to an audit log with the acting user and old and new values | System | triggers and functions, `audit_logs` | T-DB-23, 28 |
| FR-13 | Users can search historical incidents and resolutions in natural language and see ranked matches with a similarity percentage, root cause and resolution | All | `GET /api/search`, `/search`, `lib/embeddings.ts` | T-SRCH-03 to 08; T-UI-12 |
| FR-14 | The incident page lists similar historical incidents | All | `GET /api/incidents/[id]/similar`, Similar incidents panel | T-SRCH-09 to 11; T-UI-13 |
| FR-15 | Embeddings are created for new incidents and refreshed when an incident is resolved; a failure of the embedding service never blocks incident work | System | `upsertIncidentEmbedding()` | T-SRCH-01, 02, 12, 13 |
| FR-16 | An admin manages users, services (criticality, status, owner) and service dependencies | Admin | `/admin`, `/api/users`, `/api/services`, `/api/dependencies` | T-UI (manual) |
| FR-17 | The incident page shows recent deployments of the affected services and their dependencies | All | `/api/incidents/[id]/context`, deployments and dependency panels | T-DB-08; T-UI (manual) |
| FR-18 | An admin sees an analytics dashboard: open, critical and resolved counts, average resolution time, incidents per service and severity, and a trend | Admin | `/dashboard`, `/api/dashboard`, `service_incident_summary` view | T-DB-06, 07; T-UI (manual) |

FR-16 to FR-18 describe the services, deployments, dependencies and analytics modules from the agreed API contract (`API.md`); the owner of those modules should confirm that the wording matches what was built.

## Non-functional requirements

| ID | Requirement | How it is met |
|---|---|---|
| NFR-01 | Security | bcrypt password hashes; HttpOnly session cookie; credentials only in environment variables (`.env.local` is git-ignored); parameterized SQL only; identical login error for unknown email and wrong password |
| NFR-02 | Data integrity | PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL and CHECK constraints in the database, tested directly (T-DB-09 to 20) |
| NFR-03 | Atomicity and consistency | Multi-step changes run in one transaction or one stored function; a failure rolls everything back (T-DB-26, T-WF-02, T-INC-15) |
| NFR-04 | Auditability | Timeline events and audit rows are produced by triggers and functions in the database, so no client can skip them |
| NFR-05 | Reliability | If the database is unreachable the user sees a clear message within seconds; if the embedding service is down incident work continues |
| NFR-06 | Correct time handling | Timestamps are stored in UTC and converted to local time in the browser (T-INC-17) |
| NFR-07 | Testability | 30 database tests and 72 API tests run with one command (`npm run test:all`), plus manual UI cases |
