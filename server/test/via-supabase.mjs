// Runs the server tests again with the server talking to a stand-in for
// Supabase over HTTP (supabase-js and the secret key), the way it runs on the
// host. See fakeSupabase.js. Part of `npm run test:server`.
import { spawnSync } from "node:child_process";

console.log("\n# Again, through supabase-js and a stand-in for Supabase's API\n");
const { status } = spawnSync(process.execPath, ["--test", "server/test/*.test.js"], {
  stdio: "inherit",
  env: { ...process.env, TEST_DB: "supabase" },
});
process.exit(status ?? 1);
