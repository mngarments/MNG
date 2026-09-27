import { getAdminClient } from "@/lib/supabase/admin";

/** Upload an image file to the public `catalog` bucket, return its public URL. */
export async function uploadImage(
  file: File,
  prefix = "catalog"
): Promise<string> {
  const supabase = getAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("catalog")
    .upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from("catalog").getPublicUrl(path);
  return data.publicUrl;
}
