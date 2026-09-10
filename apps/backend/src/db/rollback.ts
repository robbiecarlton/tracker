import { rawClient } from "./index";
import { rollbackLast } from "./migrator";

rollbackLast()
  .then(async (reverted) => {
    console.log(reverted ? `Rolled back: ${reverted}` : "Nothing to roll back.");
    await rawClient.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await rawClient.close().catch(() => {});
    process.exit(1);
  });
