# TraceVault Database Design and Indexing

## 1. Database Choice and Justification

TraceVault uses PostgreSQL as its primary database because the platform manages structured and interconnected incident management data.

### Why PostgreSQL?

- Supports relational tables and structured schemas.
- Provides ACID transactions to maintain data consistency.
- Supports primary keys, foreign keys, and constraints.
- Supports complex SQL queries and joins.
- Provides indexing for efficient data retrieval.
- Supports the pgvector extension for vector similarity search.

### Why a Relational Database for Incidents?

Incident records contain structured information such as incident IDs, titles, descriptions, severity, status, assigned engineers, services, timestamps, and resolutions.

A relational database is suitable because:

- Incidents have well-defined relationships with services, users, deployments, and resolutions.
- Foreign keys maintain referential integrity.
- SQL supports filtering, sorting, aggregation, and joins.
- Transactions help maintain consistency when incident records are updated.

### Why pgvector for Text?

Traditional keyword-based searches may fail to identify incidents that describe similar problems using different words.

pgvector allows TraceVault to store numerical embeddings of incident text and retrieve semantically similar incidents based on vector distance.

This makes it possible to identify related incidents even when their wording differs.

## 2. Database Organization

The database contains relational tables for:

- Users and roles
- Incidents
- Incident statuses and severities
- Services
- Service dependencies
- Deployments
- Incident events
- Resolutions
- Audit logs
- Incident embeddings

These tables are connected using primary keys and foreign keys wherever applicable.

## 3. Views

Database views provide reusable representations of data without duplicating the underlying records.

Views can simplify frequently used reporting queries, such as:

- Incident summaries by status and severity.
- Incident counts grouped by service.
- Deployment history for services.
- Incident resolution information.

Views help organize reporting logic and provide a consistent interface for querying related information.

## 4. Indexing Strategy

Indexes improve query performance by reducing the amount of data PostgreSQL needs to scan for frequently used queries.

The project uses the following indexes:

| Index | Purpose |
|---|---|
| idx_incidents_status | Speeds up filtering incidents by status ID. |
| idx_incidents_severity | Speeds up filtering incidents by severity. |
| idx_incident_events_incident_time | Supports retrieving events for an incident in timestamp order. |
| idx_deployments_service_date | Supports deployment lookup by service and deployment date. |
| idx_service_dependencies_service | Supports service dependency lookup using service ID. |
| idx_incident_embeddings_vector | Supports vector similarity search using cosine distance. |

Additional indexes support primary keys, unique constraints, reporter lookup, assigned engineer lookup, and incident creation date queries.

## 5. Query Plan Analysis

The project uses PostgreSQL EXPLAIN ANALYZE to inspect query execution plans.

For demonstration purposes, sequential scans were disabled using:

```sql
SET enable_seqscan = off;
```

This helps demonstrate index usage on small sample tables.

PostgreSQL may normally choose sequential scans on small tables because scanning a small number of rows directly can be cheaper than accessing an index.

The query plan screenshots are stored in `docs/screenshots/kushi/`.

## 6. Conclusion

PostgreSQL provides reliable relational storage, while pgvector extends the database with semantic retrieval capabilities. The indexing strategy supports efficient access to frequently queried incident, deployment, event, and embedding data.