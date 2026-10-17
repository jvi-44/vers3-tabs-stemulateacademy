// Checks that the server can reach its database and that supabase/schema.sql
// is installed there, using the same settings as the server (.env or the
// environment):
//
//   npm run db:check
//
// With SUPABASE_URL and SUPABASE_SECRET_KEY set it checks the Supabase
// project; without them, the local database. It only reads.
import "dotenv/config";

let db;
try {
  db = await import("../server/db.js");
  await db.ready;
  const reference = await db.rpc("stem_reference_data");
  const stats = await db.rpc("stem_admin_stats");
  console.log(`Connected to ${db.databaseDescription}.`);
  console.log(
    `Schema is installed: ${reference.organisations.length} centres, ${reference.schoolLevels.length} school levels, ` +
      `${stats.users} student account${stats.users === 1 ? "" : "s"} saved.`,
  );
} catch (err) {
  console.error(`Not connected: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db?.closeDatabase();
}
