import { sb } from './supabase.js';
import { SCHEMA as S } from './schema.js';

// کاربران یک دپارتمان. اگر دپارتمان خالی یا "all" باشد، همه کاربران.
export async function departmentUsers(department) {
  let q = sb.from(S.profiles.table).select(S.profiles.id);
  if (department && department !== 'all') q = q.eq(S.profiles.department, department);
  const { data } = await q;
  return (data || []).map((r) => r[S.profiles.id]);
}

/**
 * اطلاعات پروژه‌ها + گیرندگان هر پروژه (سازنده + اعضای تأییدشده)
 * @returns Map<projectId, {id,title,status,deadline,department,createdBy,recipients:Set}>
 */
export async function loadProjects(projectIds) {
  const ids = [...new Set((projectIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const [{ data: projects }, { data: members }] = await Promise.all([
    sb.from(S.projects.table).select('*').in(S.projects.id, ids),
    sb.from(S.members.table).select(`${S.members.projectId}, ${S.members.userId}`)
      .in(S.members.projectId, ids).eq(S.members.status, S.members.approvedValue),
  ]);

  for (const p of projects || []) {
    map.set(p[S.projects.id], {
      id: p[S.projects.id],
      title: p[S.projects.title],
      status: p[S.projects.status],
      deadline: p[S.projects.deadline],
      department: p[S.projects.department],
      createdBy: p[S.projects.createdBy],
      recipients: new Set(p[S.projects.createdBy] ? [p[S.projects.createdBy]] : []),
    });
  }
  for (const m of members || []) map.get(m[S.members.projectId])?.recipients.add(m[S.members.userId]);
  return map;
}
