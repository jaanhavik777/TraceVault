-- =====================================================================
-- Transaction demos (commit / rollback / savepoint) + UPDATE / DELETE
-- OWNER: Jaanhavi
-- This file CHANGES data. Run 07 and 08 (queries) BEFORE it, on a fresh database.
-- One ERROR below is intentional (the rollback demo); do not use ON_ERROR_STOP.
-- =====================================================================

\echo
\echo '=== 4a. SUCCESSFUL TRANSACTION: assign incident #7 to engineer 4 (BEGIN ... COMMIT) ==='
\echo '--- before:'
SELECT i.incident_id, s.status_name, i.assigned_engineer_id
FROM incidents i JOIN incident_statuses s ON s.status_id = i.status_id WHERE i.incident_id = 7;

BEGIN;
    SELECT assign_incident(7, 4, 1);
COMMIT;

\echo '--- after: assigned, status OPEN -> INVESTIGATING (done by the stored function):'
SELECT i.incident_id, s.status_name, i.assigned_engineer_id
FROM incidents i JOIN incident_statuses s ON s.status_id = i.status_id WHERE i.incident_id = 7;
\echo '--- timeline: ASSIGNED written by the function, STATUS_CHANGE written by the TRIGGER:'
SELECT event_type, event_description FROM incident_events WHERE incident_id = 7 ORDER BY event_id;
\echo '--- audit log entries for incident #7:'
SELECT action, user_id, old_values, new_values FROM audit_logs WHERE entity_id = 7 ORDER BY audit_id;

\echo
\echo '=== 4b. FAILED TRANSACTION: assigning to the admin must roll back everything ==='
\echo '--- before:'
SELECT incident_id, assigned_engineer_id,
       (SELECT count(*) FROM incident_events WHERE incident_id = 7) AS events,
       (SELECT count(*) FROM audit_logs WHERE entity_id = 7) AS audit_rows
FROM incidents WHERE incident_id = 7;

BEGIN;
    SELECT assign_incident(7, 1, 1);   -- user 1 is an admin: the function raises an exception
ROLLBACK;

\echo '--- after ROLLBACK: nothing changed (same assignee, same event and audit counts):'
SELECT incident_id, assigned_engineer_id,
       (SELECT count(*) FROM incident_events WHERE incident_id = 7) AS events,
       (SELECT count(*) FROM audit_logs WHERE entity_id = 7) AS audit_rows
FROM incidents WHERE incident_id = 7;

\echo
\echo '=== 4c. SAVEPOINT: keep the resolution, undo only the update that violates a CHECK ==='
BEGIN;
    SELECT resolve_incident(4, 2, 'NETWORK', 'Gateway provider latency',
                            'Increased client timeout and added retry with backoff.');
    SAVEPOINT after_resolve;
    UPDATE incidents SET priority_score = 150 WHERE incident_id = 4;  -- violates chk_priority_score (0-100)
ROLLBACK TO SAVEPOINT after_resolve;
COMMIT;

\echo '--- result: resolution was kept, priority_score stayed at its default:'
SELECT i.incident_id, s.status_name, i.priority_score, r.root_cause_category, r.resolution_summary
FROM incidents i
JOIN incident_statuses s ON s.status_id = i.status_id
JOIN resolutions r ON r.incident_id = i.incident_id
WHERE i.incident_id = 4;

\echo
\echo '=== 5a. UPDATE: set priority scores from severity ==='
UPDATE incidents SET priority_score = 90 WHERE severity_id = 4;
UPDATE incidents SET priority_score = 60 WHERE severity_id = 3;
UPDATE services SET service_status = 'MAINTENANCE' WHERE service_name = 'Notification Service';
SELECT incident_id, title, priority_score FROM incidents ORDER BY priority_score DESC, incident_id;
SELECT service_name, service_status FROM services WHERE service_name = 'Notification Service';

\echo
\echo '=== 5b. DELETE with ON DELETE CASCADE ==='
INSERT INTO incidents (title, description, status_id, severity_id, reporter_id)
VALUES ('Temp test incident', 'To be deleted', 1, 1, 2);
\echo '--- temp incident exists, with the CREATED event the trigger wrote for it:'
SELECT i.incident_id, count(e.event_id) AS events
FROM incidents i LEFT JOIN incident_events e ON e.incident_id = i.incident_id
WHERE i.title = 'Temp test incident' GROUP BY i.incident_id;

DELETE FROM incidents WHERE title = 'Temp test incident';

\echo '--- after DELETE: incident gone, and no orphaned events remain (cascade):'
SELECT count(*) AS temp_incidents_left FROM incidents WHERE title = 'Temp test incident';
SELECT count(*) AS orphan_events FROM incident_events e
WHERE NOT EXISTS (SELECT 1 FROM incidents i WHERE i.incident_id = e.incident_id);
