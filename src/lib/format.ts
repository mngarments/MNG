// Formatting + numeric helpers used across the app.

/** Parse a possibly-messy numeric string ("1,234.50", " 466.00 ", "", "-") -> number. */
export function num(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const cleaned = String(input).replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const inrFormatter0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format a number as Indian Rupees, e.g. 123456.7 -> "₹1,23,456.70". */
export function inr(value: unknown, decimals = true): string {
  const n = num(value);
  return decimals ? inrFormatter.format(n) : inrFormatter0.format(n);
}

/** Plain Indian-grouped integer, e.g. 123456 -> "1,23,456". */
export function inGrouping(value: unknown): string {
  return new Intl.NumberFormat("en-IN").format(num(value));
}

/** Best-effort date formatting; accepts "01-09-2026" (DD-MM-YYYY) or ISO. */
export function safeDate(input: unknown): string {
  if (!input) return "";
  const s = String(input).trim();

  // DD-MM-YYYY
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(dt.getTime()) ? s : formatDate(dt);
  }

  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : formatDate(dt);
}

function formatDate(dt: Date): string {
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format an ISO timestamp for the tracking dashboard, e.g. "27 Sep, 7:42 PM". */
export function dateTime(input: unknown): string {
  if (!input) return "";
  const dt = new Date(String(input));
  if (isNaN(dt.getTime())) return String(input);
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
