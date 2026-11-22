import { createClient } from '@supabase/supabase-js';

// کلید service_role فقط روی سرور استفاده می‌شود، هرگز در کد فرانت.
export const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function userFromRequest(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data?.user || null;
}
