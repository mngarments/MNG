import { gunzipSync } from "node:zlib";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/tally/signature";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Receives pushes from the Tally agent on the client's server (tally-agent/).
// Authenticated by an HMAC signature, not the admin session. Ops, in order:
//   ping → start → ledgers* → vouchers* → finish

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_JSON_BYTES = 20 * 1024 * 1024;

type Payload =
  | { op: "ping" }
  | { op: "start"; kind: string; company?: string; agentVersion?: string }
  | { op: "ledgers" | "vouchers"; runId: string; rows: unknown[] }
  | {
      op: "finish";
      runId: string;
      status: string;
      counts?: Record<string, unknown>;
      error?: string | null;
    };

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const secret = process.env.TALLY_SYNC_SECRET;
  if (!secret) return bad("Tally sync is not configured (TALLY_SYNC_SECRET unset)", 503);

  const raw = Buffer.from(await req.arrayBuffer());
  const invalid = verifySignature(
    secret,
    req.headers.get("x-mng-timestamp"),
    req.headers.get("x-mng-signature"),
    raw
  );
  if (invalid) return bad(invalid, 401);

  let payload: Payload;
  try {
    const json =
      req.headers.get("x-mng-encoding") === "gzip"
        ? gunzipSync(raw, { maxOutputLength: MAX_JSON_BYTES })
        : raw;
    payload = JSON.parse(json.toString("utf8"));
  } catch {
    return bad("Body is not valid (gzipped) JSON");
  }

  const supabase = getAdminClient();

  switch (payload.op) {
    case "ping": {
      const { data, error } = await supabase
        .from("tally_sync_runs")
        .select("status, started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return bad(`Database error: ${error.message}`, 500);
      return Response.json({ ok: true, lastRun: data });
    }

    case "start": {
      if (payload.kind !== "full" && payload.kind !== "incremental") {
        return bad("kind must be 'full' or 'incremental'");
      }
      const { data, error } = await supabase.rpc("tally_start_run", {
        p_kind: payload.kind,
        p_company: payload.company ?? null,
        p_agent_version: payload.agentVersion ?? null,
      });
      if (error) return dbError(error);
      return Response.json({ runId: data });
    }

    case "ledgers":
    case "vouchers": {
      if (!UUID_RE.test(payload.runId ?? "")) return bad("runId is required");
      if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
        return bad("rows must be a non-empty array");
      }
      const running = await isRunning(supabase, payload.runId);
      if (running !== true) return running;
      const { data, error } = await supabase.rpc(
        payload.op === "ledgers" ? "tally_ingest_ledgers" : "tally_ingest_vouchers",
        { p_run: payload.runId, p_rows: payload.rows }
      );
      if (error) return dbError(error);
      return Response.json({ ok: true, count: data });
    }

    case "finish": {
      if (!UUID_RE.test(payload.runId ?? "")) return bad("runId is required");
      if (payload.status !== "success" && payload.status !== "failed") {
        return bad("status must be 'success' or 'failed'");
      }
      const { data, error } = await supabase.rpc("tally_finish_run", {
        p_run: payload.runId,
        p_status: payload.status,
        p_counts: payload.counts ?? {},
        p_error: payload.error ?? null,
      });
      if (error) return dbError(error);
      return Response.json({ ok: true, ...(data as object) });
    }

    default:
      return bad("Unknown op");
  }
}

/** A newer run supersedes an older one; reject late chunks for a closed run. */
async function isRunning(
  supabase: ReturnType<typeof getAdminClient>,
  runId: string
): Promise<true | Response> {
  const { data, error } = await supabase
    .from("tally_sync_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  if (error) return bad(`Database error: ${error.message}`, 500);
  if (!data) return bad("Unknown runId", 404);
  if (data.status !== "running") return bad(`Run is already ${data.status}`, 409);
  return true;
}

/** Bad data is the agent's problem (4xx, not retried); anything else is ours (5xx). */
function dbError(error: { code?: string; message: string }) {
  const dataProblem = /^(22|23|P0001)/.test(error.code ?? "");
  return bad(`Database error: ${error.message}`, dataProblem ? 422 : 500);
}
