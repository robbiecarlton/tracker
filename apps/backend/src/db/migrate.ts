import { rawClient } from "./index";
import { runMigrations } from "./migrator";

runMigrations()
  .then(async (applied) => {
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "No pending migrations.");
    await rawClient.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await rawClient.close().catch(() => {});
    process.exit(1);
  });
