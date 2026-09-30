/**
 * A customer can have several email addresses. They are stored in the single
 * `customers.email` column as a comma-separated list ("a@x.com, b@y.com"),
 * which nodemailer accepts directly as a `to` value.
 */

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

/** Split a stored/typed value into individual addresses (deduped, order kept). */
export function splitEmails(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[\s,;/]+/)) {
    const e = part.trim();
    if (!e || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

/** Join addresses for storage; null when there are none. */
export function joinEmails(list: string[]): string | null {
  const clean = splitEmails(list.join(","));
  return clean.length ? clean.join(", ") : null;
}

/** First invalid address in the value, if any. */
export function findInvalidEmail(value: string | null | undefined): string | null {
  return splitEmails(value).find((e) => !isValidEmail(e)) ?? null;
}
