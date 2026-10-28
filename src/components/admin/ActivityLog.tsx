// Admin page → Activity: who opened the student list, looked at a student's
// progress or changed a student, a staff account, a set-up link or a website
// sign-up, newest first and a page at a time. Kept for 12 months
// (supabase/schema.sql staff_actions).
import { useEffect, useState } from "react";
import { adminActivity, type ActivityRow } from "../../api/admin";
import { parseSql } from "./shared";

// What's done to one student (the rest are about the list, staff accounts or
// sign-ups). The same words as server/routes/admin.js and staff.js.
export const STUDENT_ACTIONS = new Set(["viewed progress", "reset PIN", "reset progress", "changed XP, level or atoms", "changed the centre"]);

const when = (sql: string) =>
  parseSql(sql)?.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) ?? sql;

export function ActivityLog({ token, onError }: { token: string; onError: (e: unknown) => void }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [changesOnly, setChangesOnly] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let current = true;
    setRows(null);
    adminActivity(token, { changesOnly })
      .then((r) => {
        if (!current) return;
        setRows(r.activity);
        setHasMore(r.hasMore);
      })
      .catch(onError);
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, changesOnly]);

  const showOlder = async () => {
    const last = rows?.[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await adminActivity(token, { before: last.actionId, changesOnly });
      setRows((list) => [...(list ?? []), ...r.activity]);
      setHasMore(r.hasMore);
    } catch (e) {
      onError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="admin-card overflow-hidden" aria-label="Activity log">
      <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60">
        <h2 className="font-display">Activity</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          Who opened the student list, looked at a student's progress or changed a student, a staff account, a set-up link or
          a website sign-up, from the staff page and here. Looking at the same thing again within an hour shows once. Kept
          for 12 months.
        </p>
        <label className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={changesOnly} disabled={loadingMore} onChange={(e) => setChangesOnly(e.target.checked)} />
          Only changes (leave out who looked)
        </label>
      </div>
      {rows === null ? (
        <p className="p-10 text-center font-bold text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-10 text-center font-semibold text-muted-foreground">Nothing yet.</p>
      ) : (
        <>
          <ul className="divide-y-2 divide-ink/10">
            {rows.map((r) => (
              <li key={r.actionId} className="px-4 sm:px-5 py-3 text-sm flex flex-wrap gap-x-2">
                <span className="font-semibold text-muted-foreground tabular-nums w-32 shrink-0">{when(r.at)}</span>
                <span className="min-w-0 break-words">
                  <b>{r.staffName}</b>
                  {r.staffEmail && <span className="text-muted-foreground"> ({r.staffEmail})</span>} {r.action}
                  {r.username ? (
                    <>
                      {" "}
                      for <b>@{r.username}</b>
                    </>
                  ) : STUDENT_ACTIONS.has(r.action) ? (
                    " for a student who has since been deleted"
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="p-4 text-center border-t-2 border-ink/10">
              <button onClick={showOlder} disabled={loadingMore} className="btn-pop btn-pop-sm">
                {loadingMore ? "Loading…" : "Show older"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
