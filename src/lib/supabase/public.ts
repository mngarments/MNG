import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Anon Supabase client for reading PUBLIC content (RLS-guarded).
 * Used by server components rendering the public one-pager.
 * Returns null when env is not configured so the site can fall back to defaults.
 */
let cached: SupabaseClient | null = null;

export function getPublicClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
