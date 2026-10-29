-- =====================================================================
-- Transaction demos (commit / rollback / savepoint) + UPDATE / DELETE
-- OWNER: Jaanhavi
-- =====================================================================

-- PART 4: TRANSACTIONS (demonstration)
-- ---------------------------------------------------------------------

-- 4a. Successful transaction: assign open incident #7 to Ravi (user 4) by admin (user 1)
BEGIN;
    SELECT assign_incident(7, 4, 1);
COMMIT;

-- 4b. Failed transaction: assigning to admin (not an engineer) must roll back everything
BEGIN;
    SELECT assign_incident(7, 1, 1);   -- raises exception
ROLLBACK;

-- Verify nothing changed from the failed attempt
SELECT incident_id, assigned_engineer_id FROM incidents WHERE incident_id = 7;

-- 4c. Resolve with SAVEPOINT demo
BEGIN;
    SELECT resolve_incident(4, 2, 'NETWORK', 'Gateway provider latency',
                            'Increased client timeout and added retry with backoff.');
    SAVEPOINT after_resolve;
    UPDATE incidents SET priority_score = 150 WHERE incident_id = 4;  -- violates CHECK
ROLLBACK TO SAVEPOINT after_resolve;
COMMIT;

-- ---------------------------------------------------------------------

-- PART 5: DML - UPDATE and DELETE
-- ---------------------------------------------------------------------

UPDATE incidents SET priority_score = 90 WHERE severity_id = 4;
UPDATE incidents SET priority_score = 60 WHERE severity_id = 3;

UPDATE services SET service_status = 'MAINTENANCE' WHERE service_name = 'Notification Service';

-- DELETE demo using a throwaway incident
INSERT INTO incidents (title, description, status_id, severity_id, reporter_id)
VALUES ('Temp test incident', 'To be deleted', 1, 1, 2);
DELETE FROM incidents WHERE title = 'Temp test incident';   -- cascades to its events

-- ---------------------------------------------------------------------
