
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { searchSimilar } = await import("../lib/embeddings");

  const results = await searchSimilar(
    "Payment service failure due to database connection timeout",
    5
  );

  console.log("Similar incidents found:");
  console.table(results);
}

main().catch((error) => {
  console.error("Search test failed:", error);
  process.exitCode = 1;
});
