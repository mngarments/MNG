import { uploadImage } from "@/lib/storage";

/**
 * Read a create/update payload from a request that may be JSON or multipart
 * form-data. If an `image` File is present it is uploaded and its public URL is
 * placed on `image_url`. Numeric fields are coerced. Returns a plain record.
 */
export async function readEntityBody(
  req: Request,
  numericFields: string[] = [],
  boolFields: string[] = []
): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";

  let raw: Record<string, unknown> = {};
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        if (key === "image" && value.size > 0) {
          raw.image_url = await uploadImage(value);
        }
      } else {
        raw[key] = value;
      }
    }
  } else {
    raw = (await req.json()) as Record<string, unknown>;
  }

  for (const f of numericFields) {
    if (raw[f] !== undefined && raw[f] !== "") raw[f] = Number(raw[f]);
    else if (raw[f] === "") raw[f] = null;
  }
  for (const f of boolFields) {
    if (raw[f] !== undefined)
      raw[f] = raw[f] === true || raw[f] === "true" || raw[f] === "on";
  }
  return raw;
}
