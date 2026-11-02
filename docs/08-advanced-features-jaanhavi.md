# 8a. Transactions, triggers and stored functions

Implemented in `sql/03_jaanhavi_triggers_functions.sql`, used by the incident routes under `app/api/incidents/`, demonstrated by `sql/06_jaanhavi_transactions_dml.sql`, and verified through `tests/db-tests.sql` and `tests/api.test.mjs`.

| Feature | What it does | Where it runs | Verified by |
|---|---|---|---|
| Triggers (3) | Maintain `updated_at`; automatically create timeline events; record status changes and audit entries | Database | T-DB-21 to 24, T-WF-05, T-WF-11 |
| Stored functions (2) | `assign_incident()` and `resolve_incident()` perform multi-step business operations atomically | Database, called by the API | T-DB-25 to 29, T-WF-01 to 04, T-WF-18, T-WF-19 |
| Transactions | Ensure multiple statements succeed or fail together, using row locking where required | SQL demos, stored functions and application code (`withTransaction`) | T-DB-26, T-INC-15, T-WF-02 |

## 1. Why this logic lives in the database

The incident timeline and audit log provide evidence of what happened during an investigation. If the application alone were responsible for writing these records, a bug, script or second client could bypass the history.

Database triggers make timeline and audit updates automatic. Stored functions keep multi-step operations consistent regardless of which application component calls them. Implementing these rules in PostgreSQL ensures that they are enforced at the database level.

## 2. Triggers

| Trigger | Table and event | Action |
|---|---|---|
| `set_incident_updated_at` | BEFORE UPDATE on `incidents` | Updates `updated_at` to the current timestamp |
| `incident_created_event` | AFTER INSERT on `incidents` | Inserts a `CREATED` event into `incident_events`, attributed to the reporter |
| `incident_status_change` | AFTER UPDATE OF `status_id` on `incidents` | Inserts a `STATUS_CHANGE` event and an `audit_logs` row containing the old and new status |

### Automatic incident creation event

When an incident is inserted, the trigger creates its initial timeline event automatically.

```sql
CREATE OR REPLACE FUNCTION trg_incident_created() RETURNS trigger AS $$
BEGIN
    INSERT INTO incident_events (
        incident_id,
        user_id,
        event_type,
        event_description,
        event_timestamp
    )
    VALUES (
        NEW.incident_id,
        NEW.reporter_id,
        'CREATED',
        'Incident created: ' || NEW.title,
        NEW.created_at
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Status-change event and audit logging

The status trigger needs to identify the user who performed the change. Since a database trigger does not automatically know the authenticated application user, the application and stored functions set a transaction-local PostgreSQL setting first:

```sql
SELECT set_config('app.user_id', '<id>', true);
```

The trigger retrieves this value using `current_setting('app.user_id', true)`. The setting is transaction-local and disappears when the transaction ends.

```sql
CREATE OR REPLACE FUNCTION trg_incident_status_change() RETURNS trigger AS $$
DECLARE
    v_old TEXT;
    v_new TEXT;
    v_actor INT := NULLIF(current_setting('app.user_id', true), '')::INT;
BEGIN
    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
        SELECT status_name INTO v_old
        FROM incident_statuses
        WHERE status_id = OLD.status_id;

        SELECT status_name INTO v_new
        FROM incident_statuses
        WHERE status_id = NEW.status_id;

        INSERT INTO incident_events (
            incident_id, user_id, event_type, event_description
        )
        VALUES (
            NEW.incident_id,
            v_actor,
            'STATUS_CHANGE',
            'Status changed from ' || v_old || ' to ' || v_new
        );

        INSERT INTO audit_logs (
            user_id, action, entity_name, entity_id, old_values, new_values
        )
        VALUES (
            v_actor,
            'STATUS_CHANGE',
            'incidents',
            NEW.incident_id,
            jsonb_build_object('status', v_old),
            jsonb_build_object('status', v_new)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 3. Stored functions

### `assign_incident(incident, engineer, acting user)`

This function assigns an incident to an engineer and performs the related updates in one database operation.

1. Checks that the specified user exists, has the ENGINEER role and is active. Otherwise, it raises an exception.
2. Locks the incident row using `SELECT ... FOR UPDATE`, preventing concurrent assignments from overwriting each other.
3. Checks that the incident exists.
4. Records the acting user using the transaction-local `app.user_id` setting.
5. Updates the assignee and moves an OPEN incident to INVESTIGATING.
6. Writes an `ASSIGNED` timeline event and an `ASSIGN` audit entry containing the old and new assignee.

If any step fails, PostgreSQL rolls back the entire function call. This prevents an assignment from being saved without its corresponding timeline and audit records.

```sql
CREATE OR REPLACE FUNCTION assign_incident(
    p_incident_id INT,
    p_engineer_id INT,
    p_actor_id    INT
) RETURNS VOID AS $$
DECLARE
    v_role   TEXT;
    v_active BOOLEAN;
    v_old_engineer INT;
BEGIN
    SELECT r.role_name, u.is_active
    INTO v_role, v_active
    FROM users u
    JOIN roles r ON r.role_id = u.role_id
    WHERE u.user_id = p_engineer_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User % does not exist', p_engineer_id;
    ELSIF v_role <> 'ENGINEER' OR NOT v_active THEN
        RAISE EXCEPTION 'User % is not an active engineer', p_engineer_id;
    END IF;

    SELECT assigned_engineer_id
    INTO v_old_engineer
    FROM incidents
    WHERE incident_id = p_incident_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % does not exist', p_incident_id;
    END IF;

    PERFORM set_config('app.user_id', p_actor_id::TEXT, true);

    UPDATE incidents
    SET assigned_engineer_id = p_engineer_id,
        status_id = CASE WHEN status_id = 1 THEN 2 ELSE status_id END
    WHERE incident_id = p_incident_id;

    INSERT INTO incident_events (
        incident_id, user_id, event_type, event_description
    )
    VALUES (
        p_incident_id,
        p_actor_id,
        'ASSIGNED',
        'Assigned to ' || (
            SELECT full_name FROM users WHERE user_id = p_engineer_id
        )
    );

    INSERT INTO audit_logs (
        user_id, action, entity_name, entity_id, old_values, new_values
    )
    VALUES (
        p_actor_id,
        'ASSIGN',
        'incidents',
        p_incident_id,
        jsonb_build_object('assigned_engineer_id', v_old_engineer),
        jsonb_build_object('assigned_engineer_id', p_engineer_id)
    );
END;
$$ LANGUAGE plpgsql;
```

### `resolve_incident(incident, user, category, cause, summary)`

This function records the resolution, updates the incident status to RESOLVED and writes an audit entry.

The UNIQUE constraint on `resolutions.incident_id` prevents a second resolution from being recorded for the same incident.

```sql
CREATE OR REPLACE FUNCTION resolve_incident(
    p_incident_id INT,
    p_user_id     INT,
    p_category    VARCHAR,
    p_cause       TEXT,
    p_summary     TEXT
) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.user_id', p_user_id::TEXT, true);

    INSERT INTO resolutions (
        incident_id,
        root_cause_category,
        root_cause_description,
        resolution_summary,
        resolved_by
    )
    VALUES (
        p_incident_id,
        p_category,
        p_cause,
        p_summary,
        p_user_id
    );

    UPDATE incidents
    SET status_id = 4
    WHERE incident_id = p_incident_id;

    INSERT INTO audit_logs (
        user_id, action, entity_name, entity_id, new_values
    )
    VALUES (
        p_user_id,
        'RESOLVE',
        'incidents',
        p_incident_id,
        jsonb_build_object('root_cause_category', p_category)
    );
END;
$$ LANGUAGE plpgsql;
```

### How the API uses these functions

The API routes perform the necessary permission checks before calling the stored functions. Database exceptions raised using `RAISE EXCEPTION` carry SQLSTATE `P0001`; `handleError()` converts these into an appropriate API error response containing the function's message.

## 4. Transactions

Transactions ensure that related database operations are committed together or rolled back together.

| Where | Example | Guarantee |
|---|---|---|
| SQL demo (`sql/06`) | `BEGIN; SELECT assign_incident(7, 4, 1); COMMIT;` | The assignment, timeline events and audit records become visible together. |
| SQL demo (`sql/06`) | `BEGIN; SELECT assign_incident(7, 1, 1); ROLLBACK;` | The admin is not an engineer, so the function raises an exception. The failed operation does not leave a partial assignment or additional records. |
| SQL demo (`sql/06`) | `SAVEPOINT`, followed by a failing priority update and `ROLLBACK TO SAVEPOINT` | The invalid update is undone while the earlier resolution operation is retained. |
| Application (`withTransaction` in `lib/db.ts`) | Creating an incident inserts the incident and its service links; status changes lock the incident row and record the acting user. | The complete operation commits or rolls back, preventing partially created incidents. |

Row locks using `FOR UPDATE` help serialise concurrent operations on the same incident instead of allowing conflicting updates to overwrite each other. PostgreSQL's default READ COMMITTED isolation level is used, with row locking protecting the rows involved in these operations.

## 5. Evidence

| Claim | Test / demonstration | Screenshot |
|---|---|---|
| Incident creation automatically generates a CREATED event | T-DB-21 | `docs/screenshots/jaanhavi/txn-commit2.png` |
| A status change writes a timeline event and audit row | T-DB-22, T-DB-23 | `docs/screenshots/jaanhavi/txn-commit.png` |
| `assign_incident` rolls back completely when assignment fails | T-DB-25, T-DB-26, T-WF-02 | `docs/screenshots/jaanhavi/txn-rollback.png` |
| A savepoint preserves the resolution while undoing the failed update | `sql/06` section 4c | `docs/screenshots/jaanhavi/savepoint-resolution.png` |
| The change is attributed to the acting user | T-WF-11 | `docs/screenshots/jaanhavi/txn-commit.png` |
| Deleting an incident cascades to its events, links and resolution | T-DB-30 | `docs/screenshots/jaanhavi/delete-cascade.png` |

# 8b. Important SQL queries

The queries below are defined in `sql/07_jaanhavi_queries.sql`. They can be run directly using the PostgreSQL client after the database has been set up.

For example, with the Docker database:

```bash
docker exec -it tracevault-db psql -U tracevault -d tracevault
```

Then execute the queries in the SQL file or paste the individual queries into the PostgreSQL prompt. Screenshots are stored in `docs/screenshots/jaanhavi/`.

## Q1: Active incidents, most severe first

**Concepts:** JOIN, LEFT JOIN, ORDER BY

Shows the incidents that require attention. The LEFT JOIN ensures that incidents without an assigned engineer are still included.

```sql
SELECT i.incident_id, i.title, st.status_name, sv.severity_name,
       rep.full_name AS reporter, eng.full_name AS assigned_to, i.created_at
FROM incidents i
JOIN incident_statuses st   ON st.status_id = i.status_id
JOIN incident_severities sv ON sv.severity_id = i.severity_id
JOIN users rep              ON rep.user_id = i.reporter_id
LEFT JOIN users eng         ON eng.user_id = i.assigned_engineer_id
WHERE st.status_name IN ('OPEN', 'INVESTIGATING', 'MITIGATED')
ORDER BY sv.severity_id DESC, i.created_at;
```

## Q5: Unresolved, unassigned incidents older than a day

**Concepts:** Subquery, NOT EXISTS

Identifies incidents that have remained unassigned for more than one day and do not have a corresponding resolution.

```sql
SELECT incident_id, title, created_at
FROM incidents i
WHERE assigned_engineer_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM resolutions r
      WHERE r.incident_id = i.incident_id
  )
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
```

A result containing zero rows is valid: it means no incidents currently satisfy all the specified conditions.

## Q11: Full timeline of one incident

**Concepts:** JOIN, LEFT JOIN, ORDER BY

Retrieves the chronological investigation history for a selected incident, including the user associated with each event where available.

```sql
SELECT e.event_timestamp, e.event_type, e.event_description, u.full_name
FROM incident_events e
LEFT JOIN users u ON u.user_id = e.user_id
WHERE e.incident_id = 1
ORDER BY e.event_timestamp;
```