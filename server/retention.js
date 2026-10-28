// Deletes what's past its keeping time (stem_retention_purge in
// supabase/schema.sql): when the server starts, then once a day. The free
// Render instance restarts each time it wakes, so quiet weeks are covered too.
import { rpc } from "./db.js";

const DAY_MS = 24 * 3600_000;

export const purgeExpired = () =>
  rpc("stem_retention_purge", { p_now: Date.now() }).catch((err) => console.error(`[retention] ${err.message}`));

export function scheduleRetention() {
  purgeExpired();
  setInterval(purgeExpired, DAY_MS).unref();
}
