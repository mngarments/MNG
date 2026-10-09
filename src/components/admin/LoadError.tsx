import { AlertTriangle } from "lucide-react";

/** Shown when an admin list fails to load, so a broken backend never looks like "0 entries". */
export default function LoadError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">Couldn’t load data</div>
        <div>
          {message}. The counts below are not real — check the database
          connection before doing anything.
        </div>
      </div>
    </div>
  );
}

/** Pull a readable error out of a failed API response or a thrown fetch error. */
export async function describeFailure(
  res: Response | null,
  err?: unknown
): Promise<string> {
  if (res) {
    const body = await res.json().catch(() => ({}));
    return body?.error || `Request failed (${res.status})`;
  }
  return err instanceof Error ? err.message : "Network error";
}
