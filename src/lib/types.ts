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
