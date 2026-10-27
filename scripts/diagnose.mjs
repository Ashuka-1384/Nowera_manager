import fs from 'node:fs';
import path from 'node:path';

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const parsed = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    parsed[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return parsed;
}

function isSecretKey(key) {
  if (/sb_secret_|service_role/i.test(key)) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
}

const fileEnv = {
  ...readEnvFile(path.resolve('.env')),
  ...readEnvFile(path.resolve('.env.local')),
};
const url = (process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || '').trim();

console.log('\nNOWERA · بررسی اتصال\n');
if (!url || !key) {
  console.error('✗ متغیرهای اتصال پیدا نشدند. دستور npm run setup را اجرا کن.');
  process.exit(1);
}
if (!/^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url)) {
  console.error('✗ VITE_SUPABASE_URL معتبر نیست:', url);
  process.exit(1);
}
if (isSecretKey(key)) {
  console.error('✗ کلید service_role ناامن و نامناسب برای frontend است؛ از Publishable/anon استفاده کن.');
  process.exit(1);
}
console.log('✓ آدرس پروژه و کلید پیدا شدند.');

try {
  const response = await fetch(`${url}/rest/v1/rpc/list_public_members`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(12000),
  });

  if (response.ok) {
    const result = await response.json();
    console.log(`✓ اتصال به Supabase برقرار است؛ RPC فهرست اعضا کار می‌کند (${Array.isArray(result) ? result.length : 0} عضو قابل نمایش).`);
    console.log('✓ اتصال و schema اولیه آماده‌اند.');
  } else {
    const body = await response.text();
    if (response.status === 401 || response.status === 403) {
      console.error(`✗ Supabase کلید را نپذیرفت (HTTP ${response.status}). کلید Publishable/anon را دوباره بررسی کن.`);
    } else if (/list_public_members|function.*not found|PGRST202|PGRST202/i.test(body) || response.status === 404) {
      console.error('✗ به پروژه وصل شدیم، اما تابع دیتابیس پیدا نشد. فایل supabase/schema.sql را کامل در SQL Editor اجرا کن.');
    } else {
      console.error(`✗ Supabase پاسخ HTTP ${response.status} داد: ${body.slice(0, 450)}`);
    }
    process.exitCode = 1;
  }
} catch (error) {
  console.error('✗ ارتباط شبکه با Supabase برقرار نشد. URL، اینترنت/VPN، DNS یا وضعیت پروژه را بررسی کن.');
  console.error(`جزئیات فنی: ${error.message}`);
  process.exitCode = 1;
}
