-- =====================================================================
-- Triggers + stored functions (Transactions, Triggers, Stored Functions features)
-- Must run BEFORE seeding incidents so triggers auto-create timeline events
-- OWNER: Jaanhavi
-- =====================================================================

-- PART 2: ADVANCED FEATURES
-- ---------------------------------------------------------------------

-- ===== Feature: TRIGGERS =====

-- T1: keep updated_at current
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incident_updated_at
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- T2: auto-create timeline event when an incident is created
CREATE OR REPLACE FUNCTION trg_incident_created() RETURNS trigger AS $$
BEGIN
    INSERT INTO incident_events (incident_id, user_id, event_type, event_description, event_timestamp)
    VALUES (NEW.incident_id, NEW.reporter_id, 'CREATED',
            'Incident created: ' || NEW.title, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_created_event
AFTER INSERT ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_incident_created();

-- T3: auto-create timeline event + audit entry on status change
CREATE OR REPLACE FUNCTION trg_incident_status_change() RETURNS trigger AS $$
DECLARE
    v_old TEXT;
    v_new TEXT;
    v_actor INT := NULLIF(current_setting('app.user_id', true), '')::INT;
BEGIN
    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
        SELECT status_name INTO v_old FROM incident_statuses WHERE status_id = OLD.status_id;
        SELECT status_name INTO v_new FROM incident_statuses WHERE status_id = NEW.status_id;

        INSERT INTO incident_events (incident_id, user_id, event_type, event_description)
        VALUES (NEW.incident_id, v_actor, 'STATUS_CHANGE',
                'Status changed from ' || v_old || ' to ' || v_new);

        INSERT INTO audit_logs (user_id, action, entity_name, entity_id, old_values, new_values)
        VALUES (v_actor, 'STATUS_CHANGE', 'incidents', NEW.incident_id,
                jsonb_build_object('status', v_old),
                jsonb_build_object('status', v_new));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_status_change
AFTER UPDATE OF status_id ON incidents
FOR EACH ROW EXECUTE FUNCTION trg_incident_status_change();

-- ===== Feature: STORED FUNCTIONS (atomic business operations) =====

-- assign_incident: validates engineer, assigns, moves OPEN -> INVESTIGATING,
-- logs event and audit entry. The function body runs as ONE transaction:
-- any exception rolls back every step.
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
    SELECT r.role_name, u.is_active INTO v_role, v_active
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE u.user_id = p_engineer_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User % does not exist', p_engineer_id;
    ELSIF v_role <> 'ENGINEER' OR NOT v_active THEN
        RAISE EXCEPTION 'User % is not an active engineer', p_engineer_id;
    END IF;

    SELECT assigned_engineer_id INTO v_old_engineer
    FROM incidents WHERE incident_id = p_incident_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident % does not exist', p_incident_id;
    END IF;

    PERFORM set_config('app.user_id', p_actor_id::TEXT, true);

    UPDATE incidents
    SET assigned_engineer_id = p_engineer_id,
        status_id = CASE WHEN status_id = 1 THEN 2 ELSE status_id END  -- OPEN -> INVESTIGATING
    WHERE incident_id = p_incident_id;

    INSERT INTO incident_events (incident_id, user_id, event_type, event_description)
    VALUES (p_incident_id, p_actor_id, 'ASSIGNED',
            'Assigned to ' || (SELECT full_name FROM users WHERE user_id = p_engineer_id));

    INSERT INTO audit_logs (user_id, action, entity_name, entity_id, old_values, new_values)
    VALUES (p_actor_id, 'ASSIGN', 'incidents', p_incident_id,
            jsonb_build_object('assigned_engineer_id', v_old_engineer),
            jsonb_build_object('assigned_engineer_id', p_engineer_id));
END;
$$ LANGUAGE plpgsql;

-- resolve_incident: records resolution knowledge and marks incident RESOLVED
CREATE OR REPLACE FUNCTION resolve_incident(
    p_incident_id INT,
    p_user_id     INT,
    p_category    VARCHAR,
    p_cause       TEXT,
    p_summary     TEXT
) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.user_id', p_user_id::TEXT, true);

    INSERT INTO resolutions (incident_id, root_cause_category, root_cause_description,
                             resolution_summary, resolved_by)
    VALUES (p_incident_id, p_category, p_cause, p_summary, p_user_id);

    UPDATE incidents SET status_id = 4 WHERE incident_id = p_incident_id;  -- RESOLVED

    INSERT INTO audit_logs (user_id, action, entity_name, entity_id, new_values)
    VALUES (p_user_id, 'RESOLVE', 'incidents', p_incident_id,
            jsonb_build_object('root_cause_category', p_category));
END;
$$ LANGUAGE plpgsql;

