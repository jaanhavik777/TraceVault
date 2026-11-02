# 3. Entity-relationship model and relational schema

The ER diagram is included in the Lab 4 submission: [`DBMS_Lab4_MiniProject.pdf`](DBMS_Lab4_MiniProject.pdf).

The authoritative relational schema is defined in `sql/01_ddl.sql` and contains 14 tables. This section summarises the tables, relationships, referential actions and normalisation used in TraceVault.

## Tables

| Group | Table | Purpose | Key columns and relationships |
|---|---|---|---|
| Authentication | `roles` | Defines ADMIN and ENGINEER roles | PK `role_id`; `role_name` UNIQUE |
| | `users` | User accounts | PK `user_id`; FK `role_id`; `email` UNIQUE; `password_hash`; `is_active` |
| Services | `services` | Systems that can experience failures | PK `service_id`; `service_name` UNIQUE; CHECK constraints on `criticality` and `service_status`; FK `owner_id` to users (SET NULL) |
| | `service_dependencies` | Records dependencies between services | FKs `service_id` and `depends_on_service_id`, both referencing services; CHECK prevents self-dependency; UNIQUE pair |
| Incidents | `incident_statuses`, `incident_severities` | Lookup tables for incident status and severity | Primary keys; names are UNIQUE |
| | `incidents` | Main incident records | FKs to status, severity, reporter and assigned engineer; `assigned_engineer_id` uses SET NULL; `priority_score` CHECK between 0 and 100 |
| | `incident_services` | Services affected by an incident | Composite PK (`incident_id`, `service_id`); `is_primary` |
| | `incident_events` | Chronological investigation timeline | FK `incident_id` (CASCADE); FK `user_id` (SET NULL); `event_type`; `event_timestamp` |
| Deployments | `deployments` | Records service releases | FK `service_id` (CASCADE); FK `deployed_by`; CHECK on `deployment_status` |
| | `incident_deployments` | Links incidents to related deployments | Composite PK (`incident_id`, `deployment_id`) |
| Resolution | `resolutions` | Stores root cause and resolution details | FK `incident_id` UNIQUE (one resolution per incident, CASCADE); FK `resolved_by` |
| Semantic search | `incident_embeddings` | Stores vector embeddings for incidents | FK `incident_id` UNIQUE (CASCADE); `embedding VECTOR(768)`; `source_text`; `embedding_model` |
| Auditing | `audit_logs` | Records who changed what | FK `user_id` (SET NULL); `old_values` and `new_values` as JSONB |

## Relationships

| Relationship type | Relationships |
|---|---|
| One-to-many | Roles to users; users to incidents (as reporter or assignee); services to deployments; incidents to incident events; users to audit logs |
| One-to-one | Incidents to resolutions; incidents to incident embeddings. Both are enforced through UNIQUE constraints on the foreign keys. |
| Many-to-many | Incidents and services (`incident_services`); incidents and deployments (`incident_deployments`) |
| Self-referencing many-to-many | Services depend on other services (`service_dependencies`). This supports recursive queries to identify indirect dependents of a failing service. |

## Referential actions

- **ON DELETE CASCADE:** Used for records that only make sense in the context of their parent. Deleting an incident removes its timeline events, service links, resolution and embedding.
- **ON DELETE SET NULL:** Used where the record should survive the removal of a user. This applies to `assigned_engineer_id`, `owner_id`, `deployed_by`, `resolved_by`, and the user references in timeline events and audit rows.
- **Lookup-table references:** Incident status and severity references are maintained through foreign keys, ensuring that incidents always reference valid lookup records.

## Normalisation

Roles, statuses and severities are maintained in separate lookup tables instead of being repeatedly stored as strings. This reduces duplication and avoids update anomalies.

Many-to-many relationships are represented through junction tables with composite primary keys. Each non-key attribute depends on the key of its own table, supporting Third Normal Form (3NF).

The deliberate denormalisation is `incident_embeddings.source_text`. It stores the exact text used to generate an embedding, allowing the vector to be audited and regenerated when required.