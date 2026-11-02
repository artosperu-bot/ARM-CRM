
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Only publishable keys may be used in a browser. All private integrations use backend APIs.
export const supabase = url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const isSupabaseConfigured = supabase !== null;
