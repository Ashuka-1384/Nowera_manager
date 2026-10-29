import { json, requireSuperAdmin } from './_lib/admin.js';
import { normalizePhone, phoneToAuthEmail } from '../src/lib/helpers.js';

const departments = new Set(['Lumen', 'Atlas', 'Technoplus', 'Horizen']);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  try {
    const context = await requireSuperAdmin(req, res);
    if (!context) return;
    const { full_name, phone: rawPhone, department, password } = req.body || {};
    const name = String(full_name || '').trim();
    const phone = normalizePhone(rawPhone);
    if (name.length < 2 || name.length > 100) return json(res, 400, { error: 'نام باید بین ۲ تا ۱۰۰ نویسه باشد.' });
    if (!/^\+989\d{9}$/.test(phone)) return json(res, 400, { error: 'شماره موبایل معتبر نیست؛ مانند 9123456789 وارد کنید.' });
    if (!departments.has(department)) return json(res, 400, { error: 'بخش انتخاب‌شده معتبر نیست.' });
    if (typeof password !== 'string' || password.length < 8) return json(res, 400, { error: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' });

    const { data: existing, error: lookupError } = await context.admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (lookupError) return json(res, 500, { error: 'بررسی شماره موبایل ناموفق بود.' });
    if (existing) return json(res, 409, { error: 'این شماره موبایل قبلاً عضو شده است.' });

    const { data, error } = await context.admin.auth.admin.createUser({
      email: phoneToAuthEmail(phone), password, email_confirm: true,
      user_metadata: { full_name: name, department, phone },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message || '')) return json(res, 409, { error: 'این شماره موبایل قبلاً ثبت شده است.' });
      return json(res, 400, { error: error.message || 'ایجاد حساب انجام نشد.' });
    }
    return json(res, 201, { id: data.user.id, message: 'Member created' });
  } catch (error) {
    console.error('admin-create-member failed:', error);
    return json(res, 500, { error: 'خطای داخلی هنگام ایجاد عضو رخ داد.' });
  }
}
