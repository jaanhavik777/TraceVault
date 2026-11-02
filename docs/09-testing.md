# Testing

## 1. Strategy
Testing is done at three levels, matching the layers of the system:

| Level | What it proves | How |
|---|---|---|
| Database | Constraints, triggers, stored functions, views, indexes, vector column and cascades behave as designed | `tests/db-tests.sql` (30 tests, runs in a transaction that is rolled back) |
| API | Authentication, role-based authorization, validation, the incident lifecycle and semantic search | `tests/api.test.mjs` (API tests against the running app and real PostgreSQL; the exact count is written to `docs/test-results.md`) |
| User interface | The pages work in a browser for each role | Manual test cases in section 4 (capture screenshots for cases actually executed) |

The automated tests use the real database, not mocks, so they exercise the same SQL, triggers and functions that the application uses.

## 2. Test environment
- PostgreSQL 16 with pgvector (Docker, `pgvector/pgvector:pg16`), schema and seed data from `npm run db:setup`
- Next.js application (`npm run dev`), Node.js 20+
- Ollama with `nomic-embed-text` for semantic ranking tests. If Ollama is unavailable, ranking tests are skipped and a separate API test verifies that search returns HTTP 503 with a clear explanation.
- Demo users: one admin and three engineers, all with the password `Password@123` (demo data only)

## 3. How to run the automated tests
Start the database and the app (`docker compose up -d`, then `npm run dev` in a second terminal) and make sure Ollama is running, then:

```bash
npm install
npm run test:all
```

The script resets the database to the seed data, indexes the seeded incidents with `scripts/backfill-embeddings.ts` (when Ollama is running), runs both suites, prints PASS/FAIL per test and writes the full table, with expected and
actual values, to **`docs/test-results.md`**. That file is the evidence for the results; include it (and a screenshot of the summary) in the report.
The database suite can also be run alone to take a screenshot:
`docker exec -i tracevault-db psql -U tracevault -d tracevault < tests/db-tests.sql`

### Coverage of the automated tests

| ID range | Area | Count | Examples |
|---|---|---|---|
| T-DB-01 to 05 | Schema | 5 | 14 tables, 2 roles, pgvector installed, indexes exist, `VECTOR(768)` |
| T-DB-06 to 08 | Views | 3 | per-service summary, deployment correlation |
| T-DB-09 to 17 | Data integrity | 9 | NOT NULL, CHECK, UNIQUE and FOREIGN KEY violations are rejected with the expected SQLSTATE |
| T-DB-18 to 20 | Vector column | 3 | one embedding per incident, wrong vector size rejected, cosine distance |
| T-DB-21 to 24 | Triggers | 4 | automatic CREATED / STATUS_CHANGE events, audit row, `updated_at` |
| T-DB-25 to 29 | Functions and atomicity | 5 | `assign_incident` / `resolve_incident`, complete rollback on failure |
| T-DB-30 | Cascade | 1 | deleting an incident removes its events, links and resolution |
| T-AUTH-01 to 13 | Authentication and authorization | 13 | login, no user enumeration, tampered cookie, role redirects |
| T-INC-01 to 19 | Incident list, filters, create, detail | 19 | all filters, SQL-injection text, validation, correct timestamps |
| T-WF-01 to 27 | Workflow | 27 | assign, status rules, timeline, resolve, permissions, frozen closed incidents |
| T-SRCH-01 to 13 | Semantic search | 13 | every incident indexed with 768-dim vectors, ranking, similar-incident lookup, automatic indexing on create and resolve |
| T-SRCH-14 | Semantic-search availability | 1 (when Ollama is unavailable) | API returns HTTP 503 with a clear message instead of a successful empty result |

## 4. Manual user-interface test cases
Run each case in the browser, record the actual result, and save a screenshot as `docs/screenshots/ui-<ID>.png` for cases executed.

| ID | Steps | Expected | Result |
|---|---|---|---|
| T-UI-01 | Open `/login`, enter a valid email and a wrong password | "Invalid email or password" is shown, no redirect | ☐ pass ☐ fail |
| T-UI-02 | Log in as an engineer | Redirected to `/incidents`; nav shows Incidents and Search only | ☐ pass ☐ fail |
| T-UI-03 | As an engineer open `/admin` and `/dashboard` | Redirected back to `/incidents` | ☐ pass ☐ fail |
| T-UI-04 | Log in as admin | Nav also shows Dashboard and Admin; no "New incident" button | ☐ pass ☐ fail |
| T-UI-05 | On `/incidents` filter by status, severity and service | Table updates; "Clear filters" restores all rows | ☐ pass ☐ fail |
| T-UI-06 | As an engineer submit "New incident" with no service selected | Error message, nothing created | ☐ pass ☐ fail |
| T-UI-07 | Create an incident with two services | Redirected to its page; timeline shows "Incident created"; the time matches the local clock | ☐ pass ☐ fail |
| T-UI-08 | Open an incident assigned to another engineer | No status buttons, no resolve form, no Assign control | ☐ pass ☐ fail |
| T-UI-09 | As admin assign an unassigned incident to an engineer | Assignee shown, status INVESTIGATING, timeline gains two events | ☐ pass ☐ fail |
| T-UI-10 | As the assigned engineer move the status and add a timeline note | Status badge and timeline update | ☐ pass ☐ fail |
| T-UI-11 | As the assigned engineer record a resolution | Resolution card appears; resolve form disappears; timeline frozen | ☐ pass ☐ fail |
| T-UI-12 | On `/search` click "Use example" then "Search" | Five ranked results with similarity %, root cause and resolution | ☐ pass ☐ fail |
| T-UI-13 | Open an incident page | "Similar historical incidents" panel lists other incidents | ☐ pass ☐ fail |
| T-UI-14 | Stop Ollama, then search and open an incident's similar-incidents panel | Search displays a clear "semantic search is unavailable" message; the similar-incidents panel displays the API error instead of "no similar incidents". Incident creation and resolution remain available. | ☐ pass ☐ fail |
| T-UI-15 | Stop Docker, then try to log in | An "Database unavailable. Is Docker running?" message within seconds, no endless spinner | ☐ pass ☐ fail |
| T-UI-16 | Click "Log out", then press the browser Back button | Protected pages redirect to `/login` | ☐ pass ☐ fail |

## 5. Defects found during testing (and fixed)
Testing found real problems; each fix is covered by a test that now guards it.

| Defect | Found by | Fix | Guarded by |
|---|---|---|---|
| Timestamps created by the database displayed 5 h 30 min in the past on a machine in India: the Node driver read UTC `TIMESTAMP` values as local time | Running the application with the server in the India time zone | Parse `TIMESTAMP` columns as UTC in `lib/db.ts` | T-INC-17 |
| Any engineer could take over another engineer's incident | Review of the permission rules | Engineers may only assign unassigned incidents or their own; admins can assign any open incident | T-WF-22 to 24 |
| Resolved or closed incidents could still be assigned and receive timeline events | Review of the lifecycle rules | Rejected with 409 | T-WF-25, 26 |
| Login hung indefinitely when the database was not reachable | Manual test with Docker stopped | 5 s connection timeout and a clear 503 message | T-UI-15 |
| The demo-password script only updated users by fixed email, so a renamed seed user could never log in | Logging in as the renamed user | One statement updates every user still holding a placeholder hash | T-AUTH-06 |
| Demo query output depended on the order the SQL files were run (a data-changing demo ran first) | Running the demo files | Fixed run order in `scripts/run-demos.sh`; before/after output in the transaction demo | n/a (documented) |
| Semantic search previously failed silently when Ollama was stopped | Measured with Ollama stopped; manual case T-UI-14 | Embedding-provider failures now propagate to the API as HTTP 503 with a clear message. The search page and similar-incidents panel display that message. Incident embedding upserts remain non-blocking. | T-SRCH-14 (when Ollama is unavailable); manual T-UI-14 |
| A shared module lost an export after a merge conflict, breaking five files | `npm run typecheck` | Restored the export; typecheck is run before every merge | typecheck |

## 6. Limitations
- No load or performance testing; the data set is small by design.
- No automated browser tests; the user interface is verified with the manual cases above.
- Semantic ranking quality is judged on the example query (T-SRCH-05, T-SRCH-09) and by reading the results, not by a benchmark.
- The IVFFlat vector index is intentionally created after embeddings exist. `npm run db:vector-index` applies it idempotently; `npm run demo:reset`, `npm run test:all`, and `bash scripts/run-demos.sh ...` apply it automatically after a successful embedding backfill. If Ollama is unavailable, the backfill and vector index are skipped. PostgreSQL may still choose a sequential scan on small datasets.
- The services, dependencies, deployments, dashboard and admin APIs are not covered by the automated suite yet.
- A deactivated user stays logged in until the session token expires (8 hours).
- Test users share one demo password; this must never be used outside local development.
