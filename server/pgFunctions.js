// Calls a stem_* function in a Postgres database the way Supabase's API
// (PostgREST) does: the arguments arrive as one JSON object, are matched to the
// function's parameter names and turned into their types by Postgres, and the
// function's JSON result comes back as it is. Used for the local database and
// by the tests' stand-in for Supabase, so both behave like the real thing.

const signatures = new Map(); // function name -> [{ name, type }]

function notFound(fn, args) {
  const err = new Error(
    `Could not find the function public.${fn}(${Object.keys(args).sort().join(", ")}) in the schema cache`,
  );
  err.code = "PGRST202";
  return err;
}

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function parametersOf(db, fn) {
  if (signatures.has(fn)) return signatures.get(fn);
  const { rows } = await db.query(
    `SELECT to_json(p.proargnames) AS names,
            (SELECT json_agg(format_type(t, NULL) ORDER BY i)
               FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(t, i)) AS types
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1`,
    [fn],
  );
  if (rows.length !== 1) return null;
  const types = rows[0].types ?? [];
  const params = types.map((type, i) => ({ name: rows[0].names[i], type }));
  signatures.set(fn, params);
  return params;
}

/** Runs `public.<fn>(...)` with `args` ({ p_name: value }) and returns its result. */
export async function callFunction(db, fn, args) {
  if (!/^stem_[a-z0-9_]+$/.test(fn)) throw notFound(fn, args);
  const params = await parametersOf(db, fn);
  const expected = params?.map((p) => p.name).sort().join(",");
  if (expected === undefined || expected !== Object.keys(args).sort().join(",")) throw notFound(fn, args);

  if (params.length === 0) {
    return (await db.query(`SELECT public.${fn}() AS result`)).rows[0].result;
  }
  const columns = params.map((p) => `${quoteIdent(p.name)} ${p.type}`).join(", ");
  const call = params.map((p) => `${quoteIdent(p.name)} => a.${quoteIdent(p.name)}`).join(", ");
  const { rows } = await db.query(
    `SELECT public.${fn}(${call}) AS result FROM json_to_record($1::json) AS a(${columns})`,
    [JSON.stringify(args)],
  );
  return rows[0].result;
}
