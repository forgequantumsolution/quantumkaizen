import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Empty, Input, Segmented, Select, Table, Tag } from 'antd';
import { UserPlus, Search, Users as UsersIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useCourses, useCurricula, useAssignCourse, useAssignCurriculum, type AssignBody } from '@/lib/api/lms';
import { useUserDirectory, type DirectoryUser } from '@/features/admin/users/hooks';
import { useRoleDirectory } from '@/features/admin/roles/hooks';
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
  const [recipientSearch, setRecipientSearch] = useState('');

  const { data: courses } = useCourses({ status: 'PUBLISHED', latest_only: true });
  const { data: curricula } = useCurricula();
  const { data: usersResp } = useUserDirectory();
  const { data: rolesResp } = useRoleDirectory();
  const { data: deptResp } = useDepartments({ isActive: true, pageSize: 200 });
  const { data: sitesResp } = useSites({ pageSize: 200 });

  const assignCourse = useAssignCourse();
  const assignCurriculum = useAssignCurriculum();
  const busy = assignCourse.isPending || assignCurriculum.isPending;

  const reset = () => { setUserIds([]); setRoleId(undefined); setDeptId(undefined); setSiteId(undefined); setDue(null); };

  const allUsers = useMemo(() => usersResp?.items ?? [], [usersResp]);

  // Live preview of who the current target resolves to — mirrors the backend's
  // resolveTargetUserIds() (active users matched by the chosen dimension).
  const recipients = useMemo<DirectoryUser[]>(() => {
    if (mode === 'Users') return allUsers.filter((u) => userIds.includes(u.id));
    if (mode === 'Role') return roleId ? allUsers.filter((u) => u.roleId === roleId) : [];
    if (mode === 'Department') return deptId ? allUsers.filter((u) => u.departmentId === deptId) : [];
    if (mode === 'Site') return siteId ? allUsers.filter((u) => u.siteId === siteId) : [];
    return [];
  }, [mode, allUsers, userIds, roleId, deptId, siteId]);

  const q = recipientSearch.trim().toLowerCase();
  const shownRecipients = q
    ? recipients.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department?.name ?? '').toLowerCase().includes(q) ||
          (u.role?.name ?? '').toLowerCase().includes(q),
      )
    : recipients;

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
        {/* This page is one-off assignment. Standing "everyone in role X needs
            course Y" rules — including auto-assigning new joiners — live on the
            Qualification Matrix, which is easy to miss from here. */}
        <p className="text-[13px] text-gray-500 mt-1">
          Assigns to whoever matches <em>right now</em>. To keep a role permanently covered — including people who join it
          later — set up a rule on the{' '}
          <Link to="/lms/admin/matrix" className="text-blue-600 hover:underline">Qualification Matrix</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Assignment form ── */}
        <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-white p-5 space-y-4 self-start">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">What to assign</label>
            <Segmented block options={['Course', 'Curriculum']} value={subject} onChange={(v) => { setSubject(v as 'Course' | 'Curriculum'); setSubjectId(undefined); }} />
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
            <Segmented block options={['Users', 'Role', 'Department', 'Site']} value={mode} onChange={(v) => setMode(v as TargetMode)} />
          </div>

          {mode === 'Users' && (
            <Select
              mode="multiple" showSearch optionFilterProp="label" style={{ width: '100%' }} value={userIds} onChange={setUserIds}
              placeholder="Select users" maxTagCount="responsive"
              options={allUsers.map((u) => ({ value: u.id, label: `${u.name}${u.department ? ` · ${u.department.name}` : ''}` }))}
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
            <DatePicker value={due} onChange={setDue} style={{ width: '100%' }} disabledDate={(d) => d && d < dayjs().startOf('day')} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="primary" loading={busy} onClick={submit}>Assign</Button>
            <Tag color="blue">Existing assignments are skipped</Tag>
          </div>
        </div>

        {/* ── Recipients preview ── */}
        <div className="lg:col-span-7 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <UsersIcon size={15} className="text-gray-500" />
              Recipients
              <Tag color={recipients.length ? 'gold' : 'default'} className="ml-1">{recipients.length}</Tag>
            </h3>
            <Input
              allowClear
              prefix={<Search size={14} className="text-gray-400" />}
              placeholder="Filter recipients"
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </div>

          {recipients.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                mode === 'Users'
                  ? 'Pick users to preview who will be assigned.'
                  : `Pick a ${mode.toLowerCase()} to preview matching people.`
              }
            />
          ) : (
            <Table<DirectoryUser>
              rowKey="id"
              size="small"
              dataSource={shownRecipients}
              pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
              columns={[
                { title: 'Name', dataIndex: 'name', render: (n: string, r) => (
                  <div>
                    <div className="text-gray-900">{n}</div>
                    <div className="text-[11px] text-gray-400">{r.email}</div>
                  </div>
                ) },
                { title: 'Department', dataIndex: ['department', 'name'], width: 160, render: (_: unknown, r) => r.department?.name ?? '—' },
                { title: 'Role', dataIndex: ['role', 'name'], width: 150, render: (_: unknown, r) => r.role?.name ?? '—' },
                { title: 'Site', dataIndex: ['site', 'name'], width: 140, render: (_: unknown, r) => r.site?.name ?? '—' },
              ]}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
