import { buildApp } from "./app";
import { rawClient } from "./db";
import { runMigrations } from "./db/migrator";
import { env } from "./env";

async function main(): Promise<void> {
  const applied = await runMigrations();
  if (applied.length) {
    console.log(`Applied migrations: ${applied.join(", ")}`);
  }

  const app = buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const shutdown = async () => {
    await app.close();
    await rawClient.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
