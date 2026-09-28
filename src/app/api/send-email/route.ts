import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildStatementHtml, invoiceNumbersOf } from "@/lib/email/buildStatementHtml";
import { buildStatementExcel } from "@/lib/email/buildStatementExcel";
import { sendMail, SmtpAuthError, type MailAttachment } from "@/lib/email/mailer";
import type { SalesRow } from "@/lib/csv/parseSalesReport";
import type { PartyStatement } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SendBody {
  statement: PartyStatement;
  email: string;
  batchId?: string | null;
  isReminder?: boolean;
  // Exact CSV rows for this party (+ original column order), attached as .xlsx.
  rows?: SalesRow[];
  fields?: string[];
}

async function getBrandSettings(supabase: ReturnType<typeof getAdminClient>) {
  const { data } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", ["brand_name", "brand_tagline", "sales_email", "phone"]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.key] = typeof row.value === "string" ? row.value : String(row.value ?? "");
  }
  return map;
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    statement,
    email,
    batchId = null,
    isReminder = false,
    rows,
    fields = [],
  } = body;
  if (!statement?.partyCode || !email) {
    return Response.json(
      { error: "Missing statement or recipient email" },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  // Idempotency: don't re-send a statement already sent/opened in this batch
  // (reminders are intentionally allowed to re-send).
  if (batchId && !isReminder) {
    const { data: existing } = await supabase
      .from("email_logs")
      .select("id,status")
      .eq("batch_id", batchId)
      .eq("party_code", statement.partyCode)
      .eq("is_reminder", false)
      .in("status", ["sent", "opened"])
      .limit(1);
    if (existing && existing.length > 0) {
      return Response.json({
        skipped: true,
        reason: "already-sent",
        logId: existing[0].id,
        status: existing[0].status,
      });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const docNos = invoiceNumbersOf(statement) || statement.partyCode;
  const subject = `PT File Invoice No:${docNos}`;

  // 1) Insert a draft log to obtain the id needed for the tracking pixel.
  const { data: inserted, error: insertErr } = await supabase
    .from("email_logs")
    .insert({
      batch_id: batchId,
      party_code: statement.partyCode,
      recipient_email: email,
      subject,
      total_amount: statement.grandTotal,
      invoice_count: statement.invoiceCount,
      is_reminder: isReminder,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return Response.json(
      { error: `Could not create log: ${insertErr?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  const logId = inserted.id as string;

  // 2) Build + send.
  try {
    const brand = await getBrandSettings(supabase);
    const html = buildStatementHtml({
      statement,
      logId,
      appUrl,
      brandName: brand.brand_name || "MN Garments",
      brandTagline: brand.brand_tagline || "Master Apparel Distributor · Ranchi",
      contactEmail: brand.sales_email,
      contactPhone: brand.phone,
      isReminder,
    });

    // Attach this party's exact rows as an .xlsx (skipped for reminders,
    // which run detached from the source CSV and carry no rows).
    let attachments: MailAttachment[] | undefined;
    if (rows && rows.length > 0) {
      const { filename, content } = buildStatementExcel({
        rows,
        fields,
        partyName: statement.partyName,
        partyCode: statement.partyCode,
      });
      attachments = [
        {
          filename,
          content,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ];
    }

    await sendMail({ to: email, subject, html, attachments });

    await supabase
      .from("email_logs")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", logId);

    return Response.json({ ok: true, logId, status: "sent" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Send failed";
    await supabase
      .from("email_logs")
      .update({ status: "failed", error: message })
      .eq("id", logId);

    const status = err instanceof SmtpAuthError ? 502 : 500;
    return Response.json({ error: message, logId, status: "failed" }, { status });
  }
}
