// Shared domain types for MN Garments.

// ---- Sales CSV / statement aggregation ----

export interface LineItem {
  itemName: string;
  description: string;
  size: string;
  qty: number;
  rate: number;
  mrp: number;
  lineTotal: number;
}

export interface InvoiceSummary {
  docNo: string;
  docDate: string;
  items: LineItem[];
  pieces: number;
  taxable: number;
  gst: number;
  total: number;
}

export interface PartyStatement {
  partyCode: string;
  partyName: string;
  gstin: string;
  beat: string;
  state: string;
  invoiceCount: number;
  totalPieces: number;
  taxableValue: number;
  gst: number;
  grandTotal: number;
  invoices: InvoiceSummary[];
}

// ---- Customer directory ----

export interface Customer {
  party_code: string;
  party_name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  updated_at: string;
}

// A party row as shown in the staging table: statement + directory match.
export interface StagingRow extends PartyStatement {
  email: string | null;
  phone: string | null;
  hasEmail: boolean;
}

// ---- Email logs / batches ----

export type SendStatus = "draft" | "sent" | "failed" | "opened";

export interface EmailLog {
  id: string;
  batch_id: string | null;
  party_code: string | null;
  recipient_email: string | null;
  subject: string | null;
  total_amount: number | null;
  invoice_count: number | null;
  is_reminder: boolean;
  status: SendStatus;
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export type BatchStatus = "active" | "paused" | "completed" | "cancelled";

export interface DispatchBatch {
  id: string;
  label: string | null;
  source_filename: string | null;
  total_parties: number;
  sent_count: number;
  status: BatchStatus;
  created_at: string;
}

// ---- CRM / public content ----

export interface Brand {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  is_ready_stock: boolean;
  is_visible: boolean;
  sort_order: number;
}

export interface SisterCompany {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  location: string | null;
  image_url: string | null;
  is_visible: boolean;
  sort_order: number;
}

export interface CatalogItem {
  id: string;
  brand: string | null;
  style_code: string | null;
  description: string | null;
  mrp: number | null;
  dealer_net_rate: number | null;
  moq: string | null;
  size_curve: string | null;
  image_url: string | null;
  is_ready_stock: boolean;
  is_visible: boolean;
  sort_order: number;
}

export interface SiteSection {
  key: string;
  title: string | null;
  data: Record<string, unknown>;
  is_visible: boolean;
  sort_order: number;
}

// Global settings flattened to a simple string map for the UI.
export type SiteSettings = Record<string, string>;

export interface SiteContent {
  settings: SiteSettings;
  sections: Record<string, SiteSection>;
  brands: Brand[];
  sisterCompanies: SisterCompany[];
  catalog: CatalogItem[];
}

// --- Tally sync (amounts are +Dr / −Cr: positive = party owes us) ---------

export type TallySyncStatus = "running" | "success" | "failed";

export interface TallySyncRun {
  id: string;
  kind: "incremental" | "full";
  company: string | null;
  agent_version: string | null;
  status: TallySyncStatus;
  counts: Record<string, number>;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

/** A row of v_tally_party_outstanding. */
export interface TallyParty {
  guid: string;
  name: string;
  parent_group: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  credit_period_days: number | null;
  closing_balance: number | null;
  computed_balance: number;
  last_voucher_date: string | null;
  open_bills: number;
  bills_pending: number;
  unadjusted_credit: number;
  overdue: number;
  not_due: number;
  age_1_30: number;
  age_31_60: number;
  age_61_90: number;
  age_90_plus: number;
  oldest_due_date: string | null;
  synced_at: string;
}

/** A row of v_tally_bills. */
export interface TallyBill {
  ledger_guid: string;
  bill_name: string;
  bill_date: string | null;
  due_date: string | null;
  billed_amount: number;
  pending_amount: number;
  days_overdue: number | null;
}

export interface TallyLedgerEntry {
  guid: string;
  date: string;
  voucher_number: string | null;
  voucher_type: string | null;
  narration: string | null;
  reference: string | null;
  amount: number;
}

/** The single tally_agent_settings row; times are IST "HH:MM:SS". */
export interface TallyAgentSettings {
  enabled: boolean;
  interval_minutes: number;
  active_from: string | null;
  active_to: string | null;
  full_sync_time: string;
  sync_requested_at: string | null;
  sync_requested_full: boolean;
  agent_last_seen_at: string | null;
  agent_version: string | null;
  updated_at: string;
}
