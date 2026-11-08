import React from 'react';
import { Check, X } from 'lucide-react';
import { faDate, getDepartment } from '../lib/helpers';
import { Avatar } from '../components/ui';

export function RequestRow({ row, kind, data, decideRequest }) {
  const task = kind === 'task' ? data.tasks.find((t) => t.id === row.task_id) : null;
  const project = kind === 'project' ? data.projects.find((p) => p.id === row.project_id) : data.projects.find((p) => p.id === task?.project_id);
  const person = data.profiles.find((p) => p.id === row.user_id);
  if (!project || !person) return null;
  return <div className="nv-request">
    <Avatar profile={person} size="small" />
    <div className="nv-request-main"><strong>{person.full_name}</strong><small>{kind === 'project' ? `درخواست عضویت در «${project.title}»` : `درخواست تسک «${task?.title || ''}»`} · {getDepartment(project.department).name}</small></div>
    <span className="nv-request-time">{faDate(row.requested_at)}</span>
    <div className="nv-request-actions">
      <button className="is-approve" title="تأیید" aria-label="تأیید درخواست" onClick={() => decideRequest(kind, row.id, 'approved')}><Check size={16} /></button>
      <button className="is-reject" title="رد درخواست" aria-label="رد درخواست" onClick={() => decideRequest(kind, row.id, 'rejected')}><X size={16} /></button>
    </div>
  </div>;
}
