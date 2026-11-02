# TraceVault – Database and Application Testing

## 1. Database Constraint Tests

The following negative tests were executed against PostgreSQL.

| Test | Expected Result | Actual Result |
|---|---|---|
| Insert service with criticality `URGENT` | CHECK constraint violation | Passed – `chk_service_criticality` |
| Insert self-dependency (1,1) | Rejected | Passed – `chk_no_self_dependency` |
| Insert duplicate dependency (1,2) | Rejected | Passed – `uq_service_dependency` |
| Insert deployment with status `BROKEN` | CHECK constraint violation | Passed – `chk_deployment_status` |

All four invalid database operations were rejected successfully.

## 2. API Authorization Test

**Test:** Non-admin user attempts to create a service using `POST /api/services`.

**Expected:** HTTP 403 Forbidden.

**Actual:** HTTP 403 Forbidden.

Response:
```json
{"error":"Forbidden for your role"}
```

**Result:** Passed. Role-based access control prevents unauthorized service creation.

## 3. UI Functionality Tests

The following functional tests are included in the application testing plan:

| Test | Expected Result |
|---|---|
| Add a service dependency | New dependency appears in the dependency interface |
| Semantic incident search | Results are ranked by similarity and display similarity percentages |
| Dashboard validation | Dashboard metrics match corresponding PostgreSQL SELECT counts |

## 4. Dashboard Data Validation

Dashboard values should be verified against SQL aggregation queries for incident status, severity, and resolution metrics.

## 5. Conclusion

The database constraint tests and API authorization test executed successfully. The database rejected invalid records, enforced dependency integrity, and prevented unauthorized service creation. UI functionality and dashboard metrics should also be verified to complete end-to-end testing.