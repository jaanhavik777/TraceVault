# SQL files

Run order for a fresh database (`npm run db:setup` does 01 to 05 for you):

| File | Owner | Purpose |
|---|---|---|
| 01_ddl.sql | Shared | Schema, indexes, ALTER and DROP examples |
| 02_seed_base.sql | Shared | Roles, users, services, dependencies, deployments |
| 03_jaanhavi_triggers_functions.sql | Jaanhavi | Triggers + `assign_incident()` / `resolve_incident()` |
| 04_kushi_views.sql | Kushi | Views |
| 05_jaanhavi_seed_incidents.sql | Jaanhavi | Incidents, events, resolutions |
| 06_jaanhavi_transactions_dml.sql | Jaanhavi | Transaction demos, UPDATE/DELETE (run manually for screenshots) |
| 07_jaanhavi_queries.sql | Jaanhavi | Important queries |
| 08_kushi_queries.sql | Kushi | Important queries |
| 09_kushi_vector_and_indexes.sql | Kushi | pgvector index/search, EXPLAIN ANALYZE (run after embeddings exist) |

Notes:
- Triggers (03) must exist before incidents are seeded (05), or timeline events won't be auto-created.
- File 06 deliberately contains a failing transaction (rollback demo); do not run it with `ON_ERROR_STOP`.
- Password hashes in 02 are placeholders until the seed script (Jaanhavi) writes real bcrypt hashes.
