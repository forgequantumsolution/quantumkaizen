import { useState } from 'react';
import { App, Button, Empty, Input, Modal, Select, Table, Tag } from 'antd';
import { Layers, Plus, Trash2, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCurricula, useCreateCurriculum, useDeleteCurriculum, useCourses, type Curriculum,
} from '@/lib/api/lms';

export default function CurriculaPage() {
  const { message } = App.useApp();
  const canWrite = useHasPermission('lms_course.write');
  const { data: curricula, isLoading } = useCurricula();
  const { data: courses } = useCourses({ status: 'PUBLISHED', latest_only: true });
  const create = useCreateCurriculum();
  const del = useDeleteCurriculum();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const q = search.trim().toLowerCase();
  const rows = (curricula ?? []).filter(
    (c) => !q || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  );

  const reset = () => { setTitle(''); setDescription(''); setCourseIds([]); };

  const submit = async () => {
    if (!title.trim()) { message.error('Title is required'); return; }
    try {
      await create.mutateAsync({ title: title.trim(), description: description.trim() || null, course_ids: courseIds });
      message.success('Curriculum created');
      setOpen(false); reset();
    } catch { message.error('Could not create curriculum'); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', width: 150, render: (c: string) => <span className="font-mono text-xs">{c}</span> },
    { title: 'Title', dataIndex: 'title', width: 260, render: (t: string) => <span className="font-medium">{t}</span> },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: (d: string | null) => (
      d ? <span className="text-xs text-gray-500">{d}</span> : <span className="text-gray-300">—</span>
    ) },
    { title: 'Courses', width: 180, render: (_: unknown, r: Curriculum) => {
      const mandatory = r.courses.filter((c) => c.is_mandatory).length;
      return (
        <span className="text-xs text-gray-500">
          {r.courses.length} course{r.courses.length === 1 ? '' : 's'}
          {r.courses.length > 0 && mandatory < r.courses.length ? ` · ${mandatory} mandatory` : ''}
        </span>
      );
    } },
    { title: 'Status', dataIndex: 'is_active', width: 100, render: (a: boolean) => <Tag color={a ? 'green' : 'default'}>{a ? 'Active' : 'Inactive'}</Tag> },
    ...(canWrite ? [{
      title: '', width: 60,
      render: (_: unknown, r: Curriculum) => (
        <Trash2 size={14} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => del.mutate(r.id)} />
      ),
    }] : []),
  ];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers size={22} className="text-gray-500" /> Training Programs
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search programs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          {canWrite && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>New Curriculum</Button>}
        </div>
      </div>

      {isLoading ? null : rows.length === 0 ? (
        <Empty description={q ? 'No programs match your search.' : 'No curricula yet.'} />
      ) : (
        <Table rowKey="id" dataSource={rows} columns={columns} size="small"
          expandable={{
            expandedRowRender: (r) => (
              <div className="pl-[198px] py-0.5">
                <ol className="border-l-2 border-gray-200 pl-4 text-sm text-gray-700 space-y-1">
                  {r.courses.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-mono w-4 text-right shrink-0">{i + 1}.</span>
                      <span className="font-mono text-xs text-gray-500">{c.code}</span>
                      <span>{c.title}</span>
                    </li>
                  ))}
                  {r.courses.length === 0 && <span className="text-gray-400">No courses</span>}
                </ol>
              </div>
            ),
          }}
        />
      )}

      <Modal title="New Curriculum" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Create" confirmLoading={create.isPending} width={560}>
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-gray-600">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New QA Analyst Onboarding" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Description</label>
            <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Courses (ordered)</label>
            <Select
              mode="multiple" showSearch optionFilterProp="label" style={{ width: '100%' }} value={courseIds} onChange={setCourseIds}
              placeholder="Add published courses"
              options={(courses?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
