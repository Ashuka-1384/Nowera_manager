// با ساختار واقعی دیتابیس Nowera تطبیق داده شده (profiles / projects / tasks / events / project_members)
export const SCHEMA = {
  profiles: { table: 'profiles', id: 'id', department: 'department' },
  projects: {
    table: 'projects', id: 'id', title: 'title', department: 'department',
    status: 'status', completedValue: 'completed', deadline: 'deadline', createdBy: 'created_by',
  },
  members: {
    table: 'project_members', projectId: 'project_id', userId: 'user_id',
    status: 'status', approvedValue: 'approved',
  },
  tasks: {
    table: 'tasks', id: 'id', title: 'title', projectId: 'project_id',
    status: 'status', doneValue: 'done', dueDate: 'due_date', createdBy: 'created_by',
  },
  events: {
    table: 'events', id: 'id', title: 'title', eventDate: 'event_date',
    department: 'department', createdBy: 'created_by',
  },
  pushSubs: { table: 'push_subscriptions' },
  notificationLog: { table: 'notification_log' },
};

export const TIMEZONE = 'Asia/Tehran';
export const DIGEST_HOUR = 8; // ساعت ارسال یادآورهای روزانه (به وقت تهران)
