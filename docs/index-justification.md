# Index Justification and Query Plan Analysis

## Query Plan Demonstration

The query plans were captured using `EXPLAIN ANALYZE` with `enable_seqscan` disabled to demonstrate the available indexes.

PostgreSQL may normally prefer a sequential scan on small tables because scanning a few rows directly can be cheaper than using an index. Disabling sequential scans for this demonstration helps show how the indexes can be used. This setting was applied only to the individual demonstration queries.

## Index Justification

1. **idx_incidents_status** – Speeds up filtering incidents using their status ID.

2. **idx_incidents_severity** – Speeds up filtering incidents based on severity.

3. **idx_incident_events_incident_time** – Speeds up retrieving events belonging to an incident in timestamp order.

4. **idx_deployments_service_date** – Speeds up retrieving deployments for a particular service, ordered by deployment date.

5. **idx_service_dependencies_service** – Speeds up looking up service dependencies using the service ID.

6. **idx_incident_embeddings_vector** – Supports efficient vector similarity searches between incident embeddings using cosine distance.

## Query Plan Screenshots

The following screenshots demonstrate index usage:

- `screenshots/kushi/index-status.png`
- `screenshots/kushi/index-events.png`
- `screenshots/kushi/index-deployments.png`
