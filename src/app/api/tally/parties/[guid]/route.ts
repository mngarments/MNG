import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/tally/queries";
import type { TallyBill, TallyLedgerEntry, TallyParty } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LineRow {
  amount: number;
  voucher: Omit<TallyLedgerEntry, "amount">;
}

/** One party: summary, open bills, and every ledger entry (oldest first). */
export async function GET(_req: Request, ctx: RouteContext<"/api/tally/parties/[guid]">) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { guid } = await ctx.params;
  const supabase = getAdminClient();

  try {
    const [partyRes, billsRes, lines] = await Promise.all([
      supabase.from("v_tally_party_outstanding").select("*").eq("guid", guid).maybeSingle(),
      supabase
        .from("v_tally_bills")
        .select("*")
        .eq("ledger_guid", guid)
        .order("due_date", { ascending: true, nullsFirst: true }),
      fetchAllPages<LineRow>(
        (from, to) =>
          supabase
          .from("tally_voucher_lines")
          .select(
            "amount, voucher:tally_vouchers!inner(guid, date, voucher_number, voucher_type, narration, reference)"
          )
          .eq("ledger_guid", guid)
          .eq("voucher.is_deleted", false)
          .eq("voucher.is_cancelled", false)
          .eq("voucher.is_optional", false)
          .order("voucher_guid")
          .range(from, to) as unknown as PromiseLike<{
          data: LineRow[] | null;
          error: { message: string } | null;
        }>
      ),
    ]);
    if (partyRes.error) throw new Error(partyRes.error.message);
    if (billsRes.error) throw new Error(billsRes.error.message);
    if (!partyRes.data) {
      return Response.json({ error: "Party not found" }, { status: 404 });
    }

    const { data: ledger, error } = await supabase
      .from("tally_ledgers")
      .select("opening_balance")
      .eq("guid", guid)
      .single();
    if (error) throw new Error(error.message);

    const entries: TallyLedgerEntry[] = lines
      .map((l) => ({ ...l.voucher, amount: Number(l.amount) }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.voucher_number ?? "").localeCompare(b.voucher_number ?? "", undefined, {
            numeric: true,
          })
      );

    return Response.json({
      party: partyRes.data as TallyParty,
      openingBalance: Number(ledger.opening_balance),
      bills: (billsRes.data ?? []) as TallyBill[],
      entries,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load party" },
      { status: 500 }
    );
  }
}
