import { useState } from 'react';
import { App, Button, DatePicker, Segmented, Select, Tag } from 'antd';
import { UserPlus } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useCourses, useCurricula, useAssignCourse, useAssignCurriculum, type AssignBody } from '@/lib/api/lms';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useRoles } from '@/features/admin/roles/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useSites } from '@/lib/api/sites';

type TargetMode = 'Users' | 'Role' | 'Department' | 'Site';

export default function AssignmentsPage() {
  const { message } = App.useApp();
  const [subject, setSubject] = useState<'Course' | 'Curriculum'>('Course');
  const [subjectId, setSubjectId] = useState<string>();
  const [mode, setMode] = useState<TargetMode>('Users');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [roleId, setRoleId] = useState<string>();
  const [deptId, setDeptId] = useState<string>();
  const [siteId, setSiteId] = useState<string>();
  const [due, setDue] = useState<Dayjs | null>(null);

  const { data: courses } = useCourses({ status: 'PUBLISHED', latest_only: true });
  const { data: curricula } = useCurricula();
  const { data: usersResp } = useAdminUsers({ isActive: true, pageSize: 200 });
  const { data: rolesResp } = useRoles({ pageSize: 200 });
  const { data: deptResp } = useDepartments({ isActive: true, pageSize: 200 });
  const { data: sitesResp } = useSites({ pageSize: 200 });

  const assignCourse = useAssignCourse();
  const assignCurriculum = useAssignCurriculum();
  const busy = assignCourse.isPending || assignCurriculum.isPending;

  const reset = () => { setUserIds([]); setRoleId(undefined); setDeptId(undefined); setSiteId(undefined); setDue(null); };

  const submit = async () => {
    if (!subjectId) { message.error(`Select a ${subject.toLowerCase()}`); return; }
    const body: AssignBody = { due_date: due ? due.toISOString() : null };
    if (mode === 'Users') { if (!userIds.length) { message.error('Pick at least one user'); return; } body.user_ids = userIds; }
    if (mode === 'Role') { if (!roleId) { message.error('Pick a role'); return; } body.role_id = roleId; }
    if (mode === 'Department') { if (!deptId) { message.error('Pick a department'); return; } body.department_id = deptId; }
    if (mode === 'Site') { if (!siteId) { message.error('Pick a site'); return; } body.site_id = siteId; }
    try {
      const res = subject === 'Course'
        ? await assignCourse.mutateAsync({ courseId: subjectId, body })
        : await assignCurriculum.mutateAsync({ id: subjectId, body });
      message.success(`Assigned to ${res.assigned} of ${res.targeted} user(s)`);
      reset();
    } catch {
      message.error('Assignment failed (is the course published?)');
    }
  };

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserPlus size={22} className="text-gray-500" /> Assign Training
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Assign a published course or curriculum to individual users, a role, a department or a site.</p>
      </div>

      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">What to assign</label>
          <Segmented options={['Course', 'Curriculum']} value={subject} onChange={(v) => { setSubject(v as 'Course' | 'Curriculum'); setSubjectId(undefined); }} />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{subject}</label>
          {subject === 'Course' ? (
            <Select
              showSearch optionFilterProp="label" style={{ width: '100%' }} value={subjectId} onChange={setSubjectId}
              placeholder="Select a published course"
              options={(courses?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
            />
          ) : (
            <Select
              showSearch optionFilterProp="label" style={{ width: '100%' }} value={subjectId} onChange={setSubjectId}
              placeholder="Select a curriculum"
              options={(curricula ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title} (${c.courses.length} courses)` }))}
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Assign to</label>
          <Segmented options={['Users', 'Role', 'Department', 'Site']} value={mode} onChange={(v) => setMode(v as TargetMode)} />
        </div>

        {mode === 'Users' && (
          <Select
            mode="multiple" showSearch optionFilterProp="label" style={{ width: '100%' }} value={userIds} onChange={setUserIds}
            placeholder="Select users" maxTagCount="responsive"
            options={(usersResp?.items ?? []).map((u) => ({ value: u.id, label: `${u.name}${u.department ? ` · ${u.department.name}` : ''}` }))}
          />
        )}
        {mode === 'Role' && (
          <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={roleId} onChange={setRoleId} placeholder="Select role"
            options={(rolesResp?.items ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r._count?.users ?? 0} users)` }))} />
        )}
        {mode === 'Department' && (
          <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={deptId} onChange={setDeptId} placeholder="Select department"
            options={(deptResp?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
        )}
        {mode === 'Site' && (
          <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={siteId} onChange={setSiteId} placeholder="Select site"
            options={(sitesResp?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
        )}

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Due date (optional)</label>
          <DatePicker value={due} onChange={setDue} style={{ width: 220 }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button type="primary" loading={busy} onClick={submit}>Assign</Button>
          <Tag color="blue">Existing assignments are skipped</Tag>
        </div>
      </div>
    </PageContainer>
  );
}
