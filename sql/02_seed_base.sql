
-- =====================================================================
-- Base seed data: roles, users, statuses, severities, services, dependencies, deployments
-- Replace placeholder password hashes with real bcrypt hashes (seed script)
-- OWNER: Shared
-- =====================================================================

-- PART 1: DML - INSERT (seed data)
-- ---------------------------------------------------------------------

INSERT INTO roles (role_name, description) VALUES
 ('ADMIN',    'Manages users, services, dependencies and analytics'),
 ('ENGINEER', 'Creates, investigates and resolves incidents');

-- NOTE: password_hash values below are placeholders.
-- Generate real bcrypt hashes with a Node seed script and UPDATE them.
INSERT INTO users (role_id, full_name, email, password_hash) VALUES
 (1, 'Admin User',       'admin@tracevault.io',   '$2b$10$PLACEHOLDER_ADMIN'),
 (2, 'Jaanhavi Kher',    'jaanhavi@tracevault.io','$2b$10$PLACEHOLDER_ENG1'),
 (2, 'Kushi Niranjana',  'kushi@tracevault.io',   '$2b$10$PLACEHOLDER_ENG2'),
 (2, 'Krishna Manoj',       'krishna@tracevault.io',    '$2b$10$PLACEHOLDER_ENG3');

INSERT INTO incident_statuses (status_name) VALUES
 ('OPEN'), ('INVESTIGATING'), ('MITIGATED'), ('RESOLVED'), ('CLOSED');

INSERT INTO incident_severities (severity_name) VALUES
 ('LOW'), ('MEDIUM'), ('HIGH'), ('CRITICAL');

INSERT INTO services (service_name, description, criticality, service_status, owner_id) VALUES
 ('Checkout Service',  'Customer checkout flow',        'HIGH',     'ACTIVE', 2),
 ('Order Service',     'Order creation and tracking',   'HIGH',     'ACTIVE', 2),
 ('Payment Service',   'Payment processing API',        'CRITICAL', 'ACTIVE', 3),
 ('Payment Gateway',   'External payment provider link','CRITICAL', 'ACTIVE', 3),
 ('Auth Service',      'Login and token issuing',       'HIGH',     'ACTIVE', 4),
 ('Database Cluster',  'Primary PostgreSQL cluster',    'CRITICAL', 'ACTIVE', 4),
 ('Notification Service','Email and SMS notifications', 'LOW',      'ACTIVE', 4);

-- service_id depends on depends_on_service_id
INSERT INTO service_dependencies (service_id, depends_on_service_id) VALUES
 (1, 2),  -- Checkout -> Order
 (1, 5),  -- Checkout -> Auth
 (2, 3),  -- Order -> Payment
 (2, 6),  -- Order -> Database
 (3, 4),  -- Payment -> Gateway
 (3, 6),  -- Payment -> Database
 (5, 6),  -- Auth -> Database
 (7, 2);  -- Notification -> Order

INSERT INTO deployments (service_id, version, environment, deployed_by, deployed_at, deployment_status) VALUES
 (3, 'v4.7.1', 'production', 2, '2026-08-01 09:00', 'SUCCESS'),
 (3, 'v4.7.2', 'production', 2, '2026-08-20 14:00', 'SUCCESS'),
 (3, 'v4.8.0', 'production', 3, '2026-09-10 10:00', 'ROLLED_BACK'),
 (2, 'v2.3.0', 'production', 3, '2026-09-18 16:30', 'SUCCESS'),
 (5, 'v1.9.4', 'production', 4, '2026-10-02 11:00', 'SUCCESS'),
 (3, 'v4.8.2', 'production', 2, '2026-10-27 08:00', 'SUCCESS');

-- Inserting incidents fires the "incident created" trigger (defined in Part 2),
-- so run Part 2's trigger definitions BEFORE this block if you want events
-- auto-generated. Order of execution: Part 2 -> then this block.
-- (status_id: 1 OPEN, 2 INVESTIGATING, 3 MITIGATED, 4 RESOLVED, 5 CLOSED)
-- (severity_id: 1 LOW, 2 MEDIUM, 3 HIGH, 4 CRITICAL)

-- ---------------------------------------------------------------------
