// Signed, gzipped pushes to MNG's /api/tally/ingest. Outbound HTTPS only.
//
// Signature: hex HMAC-SHA256(secret, `${timestamp}.` + raw body bytes), sent as
// X-MNG-Timestamp / X-MNG-Signature. The server rejects anything older than
// 5 minutes. Must stay in sync with src/lib/tally/signature.ts.

import crypto from "node:crypto";
import { gzipSync } from "node:zlib";

// Vercel rejects request bodies over 4.5 MB; leave headroom.
const MAX_BODY_BYTES = 3_500_000;

export function createMng({ mngUrl, syncSecret, retries = 4 }) {
  const endpoint = new URL("/api/tally/ingest", mngUrl).toString();

  async function send(payload) {
    const body = gzipSync(Buffer.from(JSON.stringify(payload)));
    if (body.length > MAX_BODY_BYTES) {
      const err = new Error("Payload too large");
      err.tooLarge = true;
      throw err;
    }

    for (let attempt = 0; ; attempt++) {
      const timestamp = String(Date.now());
      const signature = crypto
        .createHmac("sha256", syncSecret)
        .update(`${timestamp}.`)
        .update(body)
        .digest("hex");
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MNG-Encoding": "gzip",
            "X-MNG-Timestamp": timestamp,
            "X-MNG-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(120_000),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) return json;
        // Auth and validation errors won't fix themselves; don't retry them.
        if (res.status < 500 && res.status !== 429) {
          throw Object.assign(new Error(`MNG rejected ${payload.op}: ${json.error || res.status}`), {
            fatal: true,
          });
        }
        throw new Error(`MNG ${payload.op} failed: ${json.error || `HTTP ${res.status}`}`);
      } catch (err) {
        if (err.fatal || attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
  }

  /** Send rows in chunks, halving any chunk that compresses too large. */
  async function sendRows(op, runId, rows, chunkSize = 500) {
    let sent = 0;
    for (let i = 0; i < rows.length; ) {
      let size = Math.min(chunkSize, rows.length - i);
      for (;;) {
        try {
          await send({ op, runId, rows: rows.slice(i, i + size) });
          break;
        } catch (err) {
          if (!err.tooLarge || size === 1) throw err;
          size = Math.ceil(size / 2);
        }
      }
      i += size;
      sent += size;
    }
    return sent;
  }

  return {
    ping: () => send({ op: "ping" }),
    /** Check in and fetch the sync schedule set in the portal. */
    config: (agentVersion) => send({ op: "config", agentVersion }),
    start: (kind, company, agentVersion) =>
      send({ op: "start", kind, company, agentVersion }).then((r) => r.runId),
    ledgers: (runId, rows) => sendRows("ledgers", runId, rows),
    vouchers: (runId, rows) => sendRows("vouchers", runId, rows),
    finish: (runId, status, counts, error) =>
      send({ op: "finish", runId, status, counts, error: error ?? null }),
  };
}
