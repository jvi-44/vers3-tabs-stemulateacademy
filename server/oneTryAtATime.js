// Sign-in, Forgot PIN and change PIN each count a username's failed tries in
// the last 15 minutes, check the PIN or answers, then log the try. Tries sent
// together would all read the count before any of them is logged, so a burst
// could get far more than 5 guesses past the lockout. oneTryAtATime() makes the
// tries for a username (ignoring case, like the count) take turns instead.
//
// The turns are kept in this server process, which is enough while the host
// runs a single instance (one Render instance). With more than one instance,
// tries would need a lock in the database instead, as staff sign-in takes with
// pg_advisory_xact_lock in stem_staff_login_begin.

const turns = new Map(); // lower-case username -> the latest try's turn

/** Runs task() once every earlier try for the same username has finished, and
 *  returns what it returns. A try that fails still lets the next one go. */
export function oneTryAtATime(username, task) {
  const key = username.toLowerCase();
  const run = (turns.get(key) ?? Promise.resolve()).then(task);
  const turn = run.catch(() => {});
  turns.set(key, turn);
  // Forget the username once no try is waiting, so the map doesn't grow.
  turn.then(() => {
    if (turns.get(key) === turn) turns.delete(key);
  });
  return run;
}
