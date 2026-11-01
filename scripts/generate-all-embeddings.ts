
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { query } = await import("../lib/db");
  const { upsertIncidentEmbedding } = await import("../lib/embeddings");

  const incidents = await query(
    "SELECT incident_id FROM incidents ORDER BY incident_id"
  );

  console.log(`Found ${incidents.length} incidents.`);

  let successCount = 0;
  let failureCount = 0;

  for (const incident of incidents) {
    const id = Number(incident.incident_id);

    console.log(`Generating embedding for incident ${id}...`);

    const success = await upsertIncidentEmbedding(id);

    if (success) {
      successCount++;
      console.log(`Incident ${id}: SUCCESS`);
    } else {
      failureCount++;
      console.log(`Incident ${id}: FAILED`);
    }
  }

  console.log("\nEmbedding generation completed.");
  console.log("Successful:", successCount);
  console.log("Failed:", failureCount);
}

main().catch((error) => {
  console.error("Embedding generation failed:", error);
  process.exitCode = 1;
});
