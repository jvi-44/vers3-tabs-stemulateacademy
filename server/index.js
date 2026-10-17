// Entry point: starts the STEMulate Academy API. All routes live in app.js so
// the tests can import the app without opening a port.
import app from "./app.js";
import { databaseDescription, ready } from "./db.js";

// Log instead of crashing if a promise rejection ever slips past a handler.
process.on("unhandledRejection", (e) => console.error(e));

// Don't take requests until the database answers with the right tables.
try {
  await ready;
} catch (err) {
  console.error(`[db] ${err.message}`);
  process.exit(1);
}
console.log(`[db] Saving to ${databaseDescription}`);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`STEMulate Academy API running on http://localhost:${PORT}`);
});
