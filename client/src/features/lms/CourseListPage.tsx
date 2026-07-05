import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Modal, Select, Table, Tag, InputNumber, Switch } from 'antd';
import { BookOpen, Plus, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCourses,
  useCreateCourse,
  type CourseSummary,
  type CourseStatus,
  type CourseType,
} from '@/lib/api/lms';

const STATUS_COLOR: Record<CourseStatus, string> = {
  DRAFT: 'default',
  IN_REVIEW: 'gold',
  PUBLISHED: 'green',
  RETIRED: 'red',
};

const TYPE_LABEL: Record<CourseType, string> = {
  DOC_ACK: 'Document Ack',
  ELEARNING: 'E-Learning',
  CLASSROOM: 'Classroom',
  BLENDED: 'Blended',
};

export default function CourseListPage() {
  const nav = useNavigate();
  const { message } = App.useApp();
  const canWrite = useHasPermission('lms_course.write');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useCourses({ search: search || undefined, status: statusFilter });
  const create = useCreateCourse();

  // create form
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CourseType>('ELEARNING');
  const [description, setDescription] = useState('');
  const [validityMonths, setValidityMonths] = useState<number | null>(null);
  const [allowSelfEnroll, setAllowSelfEnroll] = useState(false);

  const resetForm = () => {
    setTitle('');
    setType('ELEARNING');
    setDescription('');
    setValidityMonths(null);
    setAllowSelfEnroll(false);
  };

  const submitCreate = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    try {
      const created = await create.mutateAsync({
        title: title.trim(),
        type,
        description: description.trim() || null,
        validity_months: validityMonths,
        allow_self_enroll: allowSelfEnroll,
        is_catalog_visible: allowSelfEnroll,
      });
      message.success('Course created');
      setCreateOpen(false);
      resetForm();
      nav(`/lms/admin/courses/${created.id}`);
    } catch {
      message.error('Failed to create course');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 150,
      render: (code: string, r: CourseSummary) => (
        <span className="font-mono text-xs">
          {code} <span className="text-gray-400">v{r.version}</span>
        </span>
      ),
    },
    { title: 'Title', dataIndex: 'title', render: (t: string) => <span className="font-medium">{t}</span> },
    { title: 'Type', dataIndex: 'type', width: 120, render: (t: CourseType) => TYPE_LABEL[t] },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: CourseStatus) => <Tag color={STATUS_COLOR[s]}>{s.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Content',
      width: 130,
      render: (_: unknown, r: CourseSummary) => (
        <span className="text-xs text-gray-500">
          {r.module_count} modules · {r.lesson_count} lessons
        </span>
      ),
    },
    {
      title: 'Recert',
      dataIndex: 'validity_months',
      width: 90,
      render: (m: number | null) => (m ? `${m} mo` : '—'),
    },
  ];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-gray-500" />
            Courses
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search title or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 150 }}
            options={(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED'] as CourseStatus[]).map((s) => ({
              value: s,
              label: s.replace('_', ' '),
            }))}
          />
          {canWrite && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              New Course
            </Button>
          )}
        </div>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        columns={columns}
        size="small"
        pagination={{ pageSize: 20 }}
        onRow={(r) => ({ onClick: () => nav(`/lms/admin/courses/${r.id}`), style: { cursor: 'pointer' } })}
      />

      <Modal
        title="New Course"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="Create"
        confirmLoading={create.isPending}
      >
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GMP Annual Refresher" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Type</label>
            <Select
              value={type}
              onChange={setType}
              style={{ width: '100%' }}
              options={(Object.keys(TYPE_LABEL) as CourseType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Description</label>
            <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block">Recertification (months)</label>
              <InputNumber min={1} max={120} value={validityMonths ?? undefined} onChange={(v) => setValidityMonths(v ?? null)} placeholder="none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Self-enrol catalog</label>
              <Switch checked={allowSelfEnroll} onChange={setAllowSelfEnroll} />
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
