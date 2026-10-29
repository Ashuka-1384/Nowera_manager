import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

export async function requireSuperAdmin(req, res) {
  if (!url || !anonKey || !serviceKey) {
    json(res, 503, { error: 'تنظیمات سرور ناقص است؛ متغیرهای SUPABASE_URL، SUPABASE_ANON_KEY و SUPABASE_SERVICE_ROLE_KEY را در Vercel تنظیم کنید.' });
    return null;
  }
  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) { json(res, 401, { error: 'برای انجام این عملیات ابتدا وارد شوید.' }); return null; }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authResult, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authResult?.user) { json(res, 401, { error: 'نشست شما معتبر نیست؛ دوباره وارد شوید.' }); return null; }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error } = await admin.from('profiles').select('id,role,is_active').eq('id', authResult.user.id).maybeSingle();
  if (error) { json(res, 500, { error: 'بررسی سطح دسترسی مدیر ناموفق بود.' }); return null; }
  if (!profile || !profile.is_active || profile.role !== 'super_admin') {
    json(res, 403, { error: 'فقط مدیر اصلی فعال اجازه انجام این عملیات را دارد.' });
    return null;
  }
  return { admin, user: authResult.user };
}
