import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
function isSecretKey(key) {
  if (/sb_secret_|service_role/i.test(key)) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded).role === 'service_role';
  } catch {
    return false;
  }
}
// Accept both the current Publishable-key name and the legacy anon-key name.
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(
  /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url) &&
  !url.includes('YOUR_PROJECT_ID') &&
  publicKey &&
  !/YOUR_PROJECT_ID|YOUR_SUPABASE/i.test(publicKey) &&
  !isSecretKey(publicKey)
);

export const supabase = isSupabaseConfigured
  ? createClient(url, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'X-Client-Info': 'nowera-management-web' } },
    })
  : null;
