
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { query } = await import("../lib/db");
  const { upsertIncidentEmbedding } = await import("../lib/embeddings");

  const incidents = await query(
    "SELECT incident_id FROM incidents ORDER BY incident_id"
  );

  console.log(`Found ${incidents.length} incidents to backfill.\n`);

  let successful = 0;
  let failed = 0;

  for (const incident of incidents) {
    const incidentId = Number(incident.incident_id);

    console.log(`Processing incident ${incidentId}...`);

    // upsertIncidentEmbedding catches errors and returns false.
    const result = await upsertIncidentEmbedding(incidentId);

    if (result) {
      successful++;
      console.log(`Incident ${incidentId}: SUCCESS\n`);
    } else {
      failed++;
      console.log(`Incident ${incidentId}: FAILED\n`);
    }
  }

  console.log("========== BACKFILL SUMMARY ==========");
  console.log(`Total incidents: ${incidents.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
