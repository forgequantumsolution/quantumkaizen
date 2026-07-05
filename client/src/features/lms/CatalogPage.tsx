import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Empty, Input, Select, Tag } from 'antd';
import { Compass, Search, BookOpen, Clock } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useCatalog, useSelfEnroll, type CatalogItem } from '@/lib/api/lms';

function CatalogCard({ c, onEnroll, enrolling }: { c: CatalogItem; onEnroll: () => void; enrolling: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900">{c.title}</p>
        {c.category && <Tag>{c.category}</Tag>}
      </div>
      {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-3 flex-1">{c.description}</p>}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><BookOpen size={12} /> {c.lesson_count} lessons</span>
        {c.estimated_minutes && <span className="flex items-center gap-1"><Clock size={12} /> {c.estimated_minutes} min</span>}
      </div>
      <div className="mt-3">
        {c.enrolled ? (
          <Tag color="green">Enrolled</Tag>
        ) : (
          <Button size="small" type="primary" loading={enrolling} onClick={onEnroll}>Enrol</Button>
        )}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const nav = useNavigate();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>();
  const { data, isLoading } = useCatalog(search || undefined);
  const enroll = useSelfEnroll();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort();
  const shown = category ? items.filter((i) => i.category === category) : items;

  const onEnroll = async (c: CatalogItem) => {
    setEnrollingId(c.course_id);
    try {
      const res = await enroll.mutateAsync(c.course_id);
      message.success('Enrolled');
      nav(`/lms/learn/${res.enrollment_id}`);
    } catch {
      message.error('Could not enrol');
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Compass size={22} className="text-gray-500" /> Course Catalog
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search courses"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All categories"
            value={category}
            onChange={setCategory}
            style={{ width: 190 }}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </div>

      {isLoading ? null : shown.length === 0 ? (
        <Empty description="No courses available for self-enrolment." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((c) => (
            <CatalogCard key={c.course_id} c={c} onEnroll={() => onEnroll(c)} enrolling={enrollingId === c.course_id} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
