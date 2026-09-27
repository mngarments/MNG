import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 1x1 transparent PNG.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function pixelResponse(): Response {
  return new Response(PIXEL as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/track/[id]">
) {
  const { id } = await ctx.params;

  // Always return the pixel, even if logging fails — never break the email view.
  if (id && isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      // Mark opened only if not already opened (preserves first-open time).
      await supabase
        .from("email_logs")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", id)
        .is("opened_at", null);
    } catch {
      // swallow — tracking must never surface an error to the recipient
    }
  }

  return pixelResponse();
}
