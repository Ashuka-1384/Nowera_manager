import { json, requireSuperAdmin } from './_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  try {
    const context = await requireSuperAdmin(req, res);
    if (!context) return;
    const userId = String(req.body?.user_id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json(res, 400, { error: 'شناسه عضو معتبر نیست.' });
    if (userId === context.user.id) return json(res, 400, { error: 'حذف حساب مدیر اصلی واردشده مجاز نیست.' });

    const { data: target, error: lookupError } = await context.admin.from('profiles').select('id,role,phone').eq('id', userId).maybeSingle();
    if (lookupError) return json(res, 500, { error: 'بررسی حساب عضو ناموفق بود.' });
    if (!target) return json(res, 404, { error: 'عضو موردنظر پیدا نشد.' });
    if (target.role === 'super_admin' || String(target.phone || '').replace(/\D/g, '') === '989333167279') return json(res, 403, { error: 'حذف حساب مدیر اصلی مجاز نیست.' });

    // Preserve authored work and audit integrity before removing the account.
    const reassignments = await Promise.all([
      context.admin.from('projects').update({ created_by: context.user.id }).eq('created_by', userId),
      context.admin.from('tasks').update({ created_by: context.user.id }).eq('created_by', userId),
      context.admin.from('events').update({ created_by: context.user.id }).eq('created_by', userId),
      context.admin.from('reports').update({ reviewed_by: null }).eq('reviewed_by', userId),
      context.admin.from('project_members').update({ decided_by: null }).eq('decided_by', userId),
      context.admin.from('task_members').update({ decided_by: null }).eq('decided_by', userId),
    ]);
    const failedUpdate = reassignments.find((result) => result.error);
    if (failedUpdate) return json(res, 500, { error: 'پیش از حذف، انتقال سوابق انجام نشد؛ هیچ حسابی حذف نشد. دسترسی دیتابیس را بررسی کنید.' });

    const { error } = await context.admin.auth.admin.deleteUser(userId);
    if (error) return json(res, 400, { error: error.message || 'حذف حساب انجام نشد.' });
    return json(res, 200, { message: 'Member deleted' });
  } catch (error) {
    console.error('admin-delete-member failed:', error);
    return json(res, 500, { error: 'خطای داخلی هنگام حذف عضو رخ داد.' });
  }
}
