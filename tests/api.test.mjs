// TraceVault API tests: authentication, authorization, incident lifecycle, semantic search.
// Needs: the app running (npm run dev) and a freshly seeded database with demo passwords loaded.
// Run through scripts/run-tests.sh, which resets the database first.
// Output: a readable line per test plus machine-readable "RESULT|id|PASS|description|detail" lines.
import { execSync } from "child_process";

const BASE = process.env.TV_BASE_URL ?? "http://localhost:3000";
const OLLAMA = process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_URL ?? "http://localhost:11434";
const ENG3 = process.env.TV_ENG3_EMAIL ?? "krishna@tracevault.io"; // 3rd engineer in the seed (user id 4)
const DBURL = process.env.DATABASE_URL;

let pass = 0, fail = 0, skip = 0;
function check(id, desc, ok, detail = "") {
  const res = ok ? "PASS" : "FAIL";
  ok ? pass++ : fail++;
  console.log(`${res}  ${id}  ${desc}${ok ? "" : "  -> " + detail}`);
  console.log(`RESULT|${id}|${res}|${desc}|${ok ? "" : String(detail).replace(/[|\n]/g, " ").slice(0, 160)}`);
}
function skipped(id, desc, why) {
  skip++;
  console.log(`SKIP  ${id}  ${desc}  (${why})`);
  console.log(`RESULT|${id}|SKIP|${desc}|${why}`);
}

async function login(email, password = "Password@123") {
  const r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const c = r.headers.get("set-cookie");
  return { status: r.status, cookie: c ? c.split(";")[0] : null, raw: c, body: await r.json().catch(() => null) };
}
async function call(cookie, method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
async function page(cookie, path) {
  const r = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { s: r.status, loc: r.headers.get("location") ?? "" };
}
function sql(q) {
  const cmd = process.env.TV_PSQL_CMD ?? (DBURL ? `psql "${DBURL}" -At -c` : "docker exec -i tracevault-db psql -U tracevault -d tracevault -At -c");
  try { return execSync(`${cmd} "${q.replace(/"/g, '\\"')}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; }
}
const ids = (r) => (r.j ?? []).map((x) => x.incident_id).sort((a, b) => a - b).join(",");

// ================= AUTHENTICATION =================
const A = await login("admin@tracevault.io");
check("T-AUTH-01", "valid login returns 200, a session cookie and the user's role", A.status === 200 && !!A.cookie && A.body?.role === "ADMIN", JSON.stringify(A.body));
check("T-AUTH-02", "login cookie is HttpOnly", /HttpOnly/i.test(A.raw ?? ""), A.raw);
let r = await login("admin@tracevault.io", "wrong-password");
check("T-AUTH-03", "wrong password is rejected with 401", r.status === 401, r.status);
const r2 = await login("nobody@tracevault.io", "x");
check("T-AUTH-04", "unknown email gets the same 401 message (no user enumeration)", r2.status === 401 && r2.body?.error === r.body?.error, JSON.stringify(r2.body));
r = await call(null, "POST", "/api/auth/login", { email: "not-an-email" });
check("T-AUTH-05", "malformed login body is rejected with 400", r.s === 400, r.s);
const J = await login("jaanhavi@tracevault.io"), K = await login("kushi@tracevault.io"), E3 = await login(ENG3);
check("T-AUTH-06", "all demo users can log in", [J, K, E3].every((x) => x.status === 200), [J.status, K.status, E3.status].join());
const E3name = E3.body?.fullName;
r = await call(A.cookie, "GET", "/api/auth/me");
check("T-AUTH-07", "/api/auth/me returns the logged-in user", r.s === 200 && r.j?.email === "admin@tracevault.io", JSON.stringify(r));
r = await call(null, "GET", "/api/incidents");
check("T-AUTH-08", "protected API without a session returns 401", r.s === 401, r.s);
r = await call(A.cookie + "x", "GET", "/api/auth/me");
check("T-AUTH-09", "a tampered session cookie is rejected with 401", r.s === 401, r.s);
const lo = await fetch(BASE + "/api/auth/logout", { method: "POST" });
check("T-AUTH-10", "logout clears the session cookie", /tv_session=;/.test(lo.headers.get("set-cookie") ?? "") && /Max-Age=0/i.test(lo.headers.get("set-cookie") ?? ""), lo.headers.get("set-cookie"));
let p = await page(null, "/incidents");
check("T-AUTH-11", "opening a page without a session redirects to /login", p.s === 307 && p.loc.endsWith("/login"), JSON.stringify(p));
p = await page(J.cookie, "/admin");
check("T-AUTH-12", "an engineer opening /admin is redirected to /incidents", p.s === 307 && p.loc.endsWith("/incidents"), JSON.stringify(p));
p = await page(A.cookie, "/admin");
check("T-AUTH-13", "an admin can open /admin", p.s === 200, p.s);

// ================= INCIDENT LIST, FILTERS, CREATE, DETAIL =================
r = await call(A.cookie, "GET", "/api/incidents"); const seeded = r.j?.length;
check("T-INC-01", "admin lists the 7 seeded incidents", r.s === 200 && seeded === 7, `got ${seeded}`);
r = await call(A.cookie, "GET", "/api/incidents?status=open");
check("T-INC-02", "filter by status (OPEN) returns only incident 7", r.s === 200 && ids(r) === "7", ids(r));
r = await call(A.cookie, "GET", "/api/incidents?severity=critical");
check("T-INC-03", "filter by severity (CRITICAL) returns incidents 1 and 6", ids(r) === "1,6", ids(r));
r = await call(A.cookie, "GET", "/api/incidents?serviceId=3");
check("T-INC-04", "filter by service (Payment Service) returns incidents 1, 4, 6", ids(r) === "1,4,6", ids(r));
r = await call(J.cookie, "GET", "/api/incidents?assignedTo=me");
check("T-INC-05", "assignedTo=me returns the engineer's own incident (4)", ids(r) === "4", ids(r));
r = await call(A.cookie, "GET", "/api/incidents?from=2026-10-15&to=2026-10-20");
check("T-INC-06", "date range filter returns incidents 4 and 5", ids(r) === "4,5", ids(r));
r = await call(A.cookie, "GET", "/api/incidents?from=garbage");
check("T-INC-07", "an invalid date is rejected with 400", r.s === 400, r.s);
r = await call(A.cookie, "GET", "/api/incidents?status=x';DROP TABLE incidents;--");
check("T-INC-08", "SQL injection text in a filter is harmless (parameterized query)", r.s === 200 && r.j.length === 0, r.s);
const good = { title: "Search API timeouts", description: "Search requests time out after the latest release.", severityId: 3, serviceIds: [3, 2], primaryServiceId: 3 };
r = await call(A.cookie, "POST", "/api/incidents", good);
check("T-INC-09", "an admin cannot create incidents (403)", r.s === 403, r.s);
r = await call(J.cookie, "POST", "/api/incidents", { ...good, primaryServiceId: 5 });
check("T-INC-10", "primary service must be one of the affected services (400)", r.s === 400, r.s);
r = await call(J.cookie, "POST", "/api/incidents", { ...good, serviceIds: [3, 9999] });
check("T-INC-11", "an unknown service is rejected (400, foreign key)", r.s === 400, JSON.stringify(r.j));
r = await call(J.cookie, "POST", "/api/incidents", { ...good, severityId: 99 });
check("T-INC-12", "an unknown severity is rejected (400, foreign key)", r.s === 400, JSON.stringify(r.j));
r = await call(J.cookie, "POST", "/api/incidents", { title: "x" });
check("T-INC-13", "missing or too-short fields are rejected (400)", r.s === 400, r.s);
r = await call(J.cookie, "POST", "/api/incidents", good); const NEW = r.j?.incident_id;
check("T-INC-14", "an engineer creates an incident (201)", r.s === 201 && Number.isInteger(NEW), JSON.stringify(r));
check("T-INC-15", "rejected creates left no partial rows (7 seeded + 1 new)", (await call(A.cookie, "GET", "/api/incidents")).j?.length === seeded + 1);
r = await call(A.cookie, "GET", `/api/incidents/${NEW}`);
check("T-INC-16", "detail: OPEN, two services (primary first), CREATED event by the reporter, no resolution",
  r.s === 200 && r.j.incident.status === "OPEN" && r.j.services.length === 2 && r.j.services[0].is_primary && r.j.events[0].event_type === "CREATED" && r.j.events[0].user_name === J.body?.fullName && r.j.resolution === null, JSON.stringify(r.j)?.slice(0, 200));
check("T-INC-17", "timestamps are correct: the CREATED event is within a minute of now", r.s === 200 && Math.abs(Date.now() - new Date(r.j.events[0].event_timestamp).getTime()) < 60000, r.j?.events?.[0]?.event_timestamp);
r = await call(A.cookie, "GET", "/api/incidents/abc");
check("T-INC-18", "a non-numeric incident id is rejected (400)", r.s === 400, r.s);
r = await call(A.cookie, "GET", "/api/incidents/9999");
check("T-INC-19", "a missing incident returns 404", r.s === 404, r.s);

// ================= WORKFLOW: assign, status, events, resolve =================
const ev0 = (await call(A.cookie, "GET", `/api/incidents/${NEW}`)).j.events.length;
r = await call(A.cookie, "POST", `/api/incidents/${NEW}/assign`, { engineerId: 1 });
check("T-WF-01", "assigning to a non-engineer is rejected with the function's message (400)", r.s === 400 && /not an active engineer/.test(r.j?.error), JSON.stringify(r.j));
const a1 = (await call(A.cookie, "GET", `/api/incidents/${NEW}`)).j;
check("T-WF-02", "the failed assignment rolled back completely (still OPEN, unassigned, no new events)", a1.incident.status === "OPEN" && a1.incident.assigned_engineer_id === null && a1.events.length === ev0, JSON.stringify(a1.incident));
r = await call(A.cookie, "POST", "/api/incidents/9999/assign", { engineerId: 4 });
check("T-WF-03", "assigning a missing incident returns 404", r.s === 404, r.s);
r = await call(A.cookie, "POST", `/api/incidents/${NEW}/assign`, { engineerId: 4 });
check("T-WF-04", "an admin assigns an engineer; status moves OPEN to INVESTIGATING", r.s === 200 && r.j.assigned_engineer_id === 4 && r.j.status === "INVESTIGATING", JSON.stringify(r.j));
const tl = (await call(A.cookie, "GET", `/api/incidents/${NEW}`)).j.events.map((e) => e.event_type);
check("T-WF-05", "the timeline shows ASSIGNED (function) and STATUS_CHANGE (trigger)", tl.includes("ASSIGNED") && tl.includes("STATUS_CHANGE"), tl.join());
r = await call(J.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "MITIGATED" });
check("T-WF-06", "an engineer who is not assigned cannot change the status (403)", r.s === 403, JSON.stringify(r.j));
r = await call(A.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "MITIGATED" });
check("T-WF-07", "an admin cannot change the status (403)", r.s === 403, r.s);
r = await call(E3.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "CLOSED" });
check("T-WF-08", "an invalid status transition (INVESTIGATING to CLOSED) is rejected (400)", r.s === 400, JSON.stringify(r.j));
r = await call(E3.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "RESOLVED" });
check("T-WF-09", "RESOLVED cannot be set through PATCH (400)", r.s === 400, r.s);
r = await call(E3.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "MITIGATED" });
check("T-WF-10", "the assigned engineer changes the status (200)", r.s === 200, JSON.stringify(r.j));
const ev = (await call(A.cookie, "GET", `/api/incidents/${NEW}`)).j.events; const last = ev[ev.length - 1];
check("T-WF-11", "the status trigger attributes the change to the acting user", last.event_type === "STATUS_CHANGE" && last.user_name === E3name && /INVESTIGATING to MITIGATED/.test(last.event_description), JSON.stringify(last));
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/events`, { eventType: "HYPOTHESIS", description: "Connection pool looks undersized" });
check("T-WF-12", "an engineer adds a timeline event (201)", r.s === 201 && r.j.user_name === E3name, JSON.stringify(r.j));
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/events`, { eventType: "BANANA", description: "x" });
check("T-WF-13", "an unknown event type is rejected (400)", r.s === 400, r.s);
r = await call(E3.cookie, "POST", "/api/incidents/9999/events", { eventType: "NOTE", description: "x" });
check("T-WF-14", "an event on a missing incident returns 404", r.s === 404, r.s);
r = await call(A.cookie, "POST", `/api/incidents/${NEW}/events`, { eventType: "NOTE", description: "x" });
check("T-WF-15", "an admin cannot add timeline events (403)", r.s === 403, r.s);
const res = { rootCauseCategory: "DATABASE", rootCauseDescription: "Connection pool exhausted after release", resolutionSummary: "Rolled back and doubled the pool size" };
r = await call(J.cookie, "POST", `/api/incidents/${NEW}/resolve`, res);
check("T-WF-16", "an engineer who is not assigned cannot resolve (403)", r.s === 403, r.s);
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/resolve`, { ...res, rootCauseCategory: "MAGIC" });
check("T-WF-17", "an unknown root-cause category is rejected (400)", r.s === 400, r.s);
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/resolve`, res);
check("T-WF-18", "the assigned engineer resolves the incident (201)", r.s === 201 && r.j.status === "RESOLVED", JSON.stringify(r.j));
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/resolve`, res);
check("T-WF-19", "resolving twice is rejected (409)", r.s === 409, JSON.stringify(r.j));
const fin = (await call(A.cookie, "GET", `/api/incidents/${NEW}`)).j;
check("T-WF-20", "final state: RESOLVED with the resolution stored and attributed", fin.incident.status === "RESOLVED" && fin.resolution?.root_cause_category === "DATABASE" && fin.resolution.resolved_by_name === E3name, JSON.stringify(fin.resolution));
r = await call(E3.cookie, "PATCH", `/api/incidents/${NEW}`, { status: "CLOSED" });
check("T-WF-21", "a resolved incident can be closed (200)", r.s === 200, JSON.stringify(r.j));
r = await call(J.cookie, "POST", "/api/incidents/6/assign", { engineerId: 2 });
check("T-WF-22", "an engineer cannot take over another engineer's incident (403)", r.s === 403, JSON.stringify(r.j));
r = await call(K.cookie, "POST", "/api/incidents/6/assign", { engineerId: 2 });
check("T-WF-23", "the assigned engineer can hand the incident over (200)", r.s === 200 && r.j.assigned_engineer_id === 2, JSON.stringify(r.j));
r = await call(J.cookie, "POST", "/api/incidents/7/assign", { engineerId: 2 });
check("T-WF-24", "an engineer can claim an unassigned incident (200)", r.s === 200, JSON.stringify(r.j));
r = await call(A.cookie, "POST", `/api/incidents/${NEW}/assign`, { engineerId: 2 });
check("T-WF-25", "a closed incident cannot be assigned (409)", r.s === 409, JSON.stringify(r.j));
r = await call(E3.cookie, "POST", `/api/incidents/${NEW}/events`, { eventType: "NOTE", description: "late note" });
check("T-WF-26", "a closed incident's timeline is frozen (409)", r.s === 409, JSON.stringify(r.j));
r = await call(J.cookie, "GET", "/api/lookups");
check("T-WF-27", "lookups return statuses, severities, services and engineers for the forms", r.s === 200 && r.j.statuses.length === 5 && r.j.severities.length === 4 && r.j.services.length === 7 && r.j.engineers.length === 3, JSON.stringify(Object.fromEntries(Object.entries(r.j ?? {}).map(([k, v]) => [k, v.length]))));

// ================= SEMANTIC SEARCH (needs Ollama + nomic-embed-text) =================
// The runner (scripts/run-tests.sh) indexes the seeded incidents with scripts/backfill-embeddings.ts first.
let ollamaUp = false;
try { await fetch(OLLAMA, { signal: AbortSignal.timeout(3000) }); ollamaUp = true; } catch {} // any HTTP answer means Ollama is running
if (!ollamaUp) {
  skipped("T-SRCH-00", "semantic search tests", `Ollama is not reachable at ${OLLAMA}; start it and run ollama pull nomic-embed-text`);
} else {
  const Q = "Payment requests failing after recent deployment because of database connection problems", enc = encodeURIComponent;
  const total = (await call(A.cookie, "GET", "/api/incidents")).j.length;
  const n = sql("select count(*) from incident_embeddings");
  if (n === null) skipped("T-SRCH-01", "every incident has an embedding", "psql / docker not available to the test script");
  else check("T-SRCH-01", "every incident has an embedding (seeded ones from the backfill script, new ones automatically)", n === String(total), `${n} embeddings for ${total} incidents`);
  const dims = sql("select min(vector_dims(embedding))||'/'||max(vector_dims(embedding))||'/'||min(embedding_model) from incident_embeddings");
  if (dims === null) skipped("T-SRCH-02", "stored embeddings are 768-dimensional and record the model", "psql / docker not available to the test script");
  else check("T-SRCH-02", "stored embeddings are 768-dimensional and record the model", dims === "768/768/nomic-embed-text", dims);

  r = await call(J.cookie, "GET", `/api/search?q=${enc(Q)}`);
  const results = r.j?.results ?? [], rid = results.map((x) => x.incident_id), pct = results.map((x) => x.similarity_pct);
  check("T-SRCH-03", "search returns the query and 5 results", r.s === 200 && r.j?.query === Q && results.length === 5, JSON.stringify(r.j)?.slice(0, 160));
  check("T-SRCH-04", "results are sorted by similarity, percentages between 0 and 100", pct.length > 0 && pct.every((x, i) => typeof x === "number" && x >= 0 && x <= 100 && (i === 0 || pct[i - 1] >= x)), JSON.stringify(pct));
  check("T-SRCH-05", "the payment/deployment incidents (1 or 6) rank in the top 3 for the example query", rid.slice(0, 3).some((x) => x === 1 || x === 6), JSON.stringify(rid));
  const top = results.find((x) => x.incident_id === 1);
  check("T-SRCH-06", "a result for a resolved incident carries its root cause and resolution", !!top?.root_cause && !!top?.resolution, JSON.stringify(top ?? rid));
  r = await call(J.cookie, "GET", "/api/search?q=");
  check("T-SRCH-07", "an empty query is rejected (400)", r.s === 400, r.s);
  r = await call(null, "GET", `/api/search?q=${enc(Q)}`);
  check("T-SRCH-08", "search without a session returns 401", r.s === 401, r.s);
  r = await call(J.cookie, "GET", "/api/incidents/6/similar"); const sim = r.j?.similarIncidents ?? [], sid = sim.map((x) => x.incident_id);
  check("T-SRCH-09", "similar-to-incident-6 excludes itself and ranks incident 1 in the top 3", r.s === 200 && sim.length > 0 && !sid.includes(6) && sid.slice(0, 3).includes(1), JSON.stringify(sid));
  r = await call(J.cookie, "GET", "/api/incidents/9999/similar");
  check("T-SRCH-10", "similar for a missing incident returns 404", r.s === 404, r.s);
  r = await call(J.cookie, "GET", "/api/incidents/abc/similar");
  check("T-SRCH-11", "similar with a non-numeric id returns 400", r.s === 400, r.s);
  const created = await call(J.cookie, "POST", "/api/incidents", { title: "Cache cluster evictions", description: "Hit rate dropped sharply after the maintenance window.", severityId: 2, serviceIds: [2], primaryServiceId: 2 });
  const c = sql(`select count(*) from incident_embeddings where incident_id=${created.j?.incident_id}`);
  if (c === null) skipped("T-SRCH-12", "a newly created incident is indexed automatically", "psql / docker not available to the test script");
  else check("T-SRCH-12", "a newly created incident is indexed automatically", c === "1", c);
  const src = sql(`select source_text from incident_embeddings where incident_id=${NEW}`);
  if (src === null) skipped("T-SRCH-13", "resolving an incident re-indexes it with the resolution text", "psql / docker not available to the test script");
  else check("T-SRCH-13", "resolving an incident re-indexes it with the resolution text", /Resolution: Rolled back and doubled the pool size/.test(src), src.slice(0, 120));
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
