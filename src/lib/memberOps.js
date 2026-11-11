// Member / assignment operations.
//
// Every operation first calls its secured database function (RPC). If the API layer reports that
// the function is not in its schema cache (PGRST202), the same operation is performed with plain
// table writes instead. Those writes are still fully protected by the row-level-security policies
// and the privilege-guard trigger in supabase/schema.sql, so nothing is weakened: a user can only
// do what the database already allows them to do.
//
// `client` is a supabase-js client (or anything with .from() / .rpc()); `getData` returns the
// latest loaded data so the fallbacks can look up task → project and member roles.

export const isMissingFunction = (error) => error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');

const nowIso = () => new Date().toISOString();
const firstError = (...results) => results.find((r) => r && r.error) || null;
const zeroRows = (message) => ({ data: null, error: { code: 'NOWERA_ZERO_ROWS', message } });

export function createMemberOps(client, actor, getData) {
  const viaRpc = async (name, args, fallback) => {
    const res = await client.rpc(name, args);
    if (res.error && fallback && isMissingFunction(res.error)) {
      console.warn(`[NOWERA] ${name}() is not visible to the API; using direct table operations instead.`);
      return fallback();
    }
    return res;
  };

  const decided = () => ({ status: 'approved', decided_by: actor.id, decided_at: nowIso() });
  const enrolProject = (projectId, userId) => client.from('project_members')
    .upsert({ project_id: projectId, user_id: userId, ...decided() }, { onConflict: 'project_id,user_id' });
  const enrolTask = (taskId, userId) => client.from('task_members')
    .upsert({ task_id: taskId, user_id: userId, ...decided() }, { onConflict: 'task_id,user_id' });

  const setActive = async (userId, active) => {
    const res = await client.from('profiles').update({ is_active: active }).eq('id', userId).select('id').maybeSingle();
    if (!res.error && !res.data) return zeroRows('Member could not be updated');
    return res;
  };

  return {
    assignProjectMember: (projectId, userId) => viaRpc('assign_project_member', { p_project_id: projectId, p_user_id: userId },
      () => enrolProject(projectId, userId)),

    // Assigning a task also enrols the person in the task's project (same as the RPC).
    assignTaskMember: (taskId, userId) => viaRpc('assign_task_member', { p_task_id: taskId, p_user_id: userId }, async () => {
      const task = (getData()?.tasks || []).find((t) => t.id === taskId);
      if (!task) return { data: null, error: { message: 'Task not found' } };
      const project = await enrolProject(task.project_id, userId);
      if (project.error) return project;
      return enrolTask(taskId, userId);
    }),

    // Removing a person from a project also removes their assignments on that project's tasks.
    removeProjectMember: (projectId, userId) => viaRpc('remove_project_member', { p_project_id: projectId, p_user_id: userId }, async () => {
      const taskIds = (getData()?.tasks || []).filter((t) => t.project_id === projectId).map((t) => t.id);
      if (taskIds.length) {
        const tasks = await client.from('task_members').delete().in('task_id', taskIds).eq('user_id', userId);
        if (tasks.error) return tasks;
      }
      return client.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    }),

    removeTaskMember: (taskId, userId) => viaRpc('remove_task_member', { p_task_id: taskId, p_user_id: userId },
      () => client.from('task_members').delete().eq('task_id', taskId).eq('user_id', userId)),

    deactivateMember: (userId) => viaRpc('deactivate_member', { p_user_id: userId }, async () => {
      if (userId === actor.id) return { data: null, error: { message: 'You cannot remove your own account' } };
      const res = await setActive(userId, false);
      if (res.error) return res;
      // Best effort: their unanswered requests are noise for managers now.
      await client.from('project_members').delete().eq('user_id', userId).eq('status', 'pending');
      await client.from('task_members').delete().eq('user_id', userId).eq('status', 'pending');
      return res;
    }),

    reactivateMember: (userId) => viaRpc('reactivate_member', { p_user_id: userId }, () => setActive(userId, true)),

    changeMemberDepartment: (userId, department) => viaRpc('change_member_department', { p_user_id: userId, p_department: department }, async () => {
      const target = (getData()?.profiles || []).find((p) => p.id === userId);
      const patch = { department, ...(target?.role === 'department_admin' ? { role: 'member' } : {}) };
      const res = await client.from('profiles').update(patch).eq('id', userId).select('id').maybeSingle();
      if (!res.error && !res.data) return zeroRows('Member could not be updated');
      return res;
    }),

    // Permanent deletion needs the database function (it removes the Auth account); no fallback exists.
    deleteMemberPermanently: (userId) => client.rpc('delete_member_permanently', { p_user_id: userId }),
  };
}

export { firstError };
