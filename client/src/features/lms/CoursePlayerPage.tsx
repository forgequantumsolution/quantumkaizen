import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Empty, Progress, Spin, Tag } from 'antd';
import {
  ArrowLeft, CheckCircle2, Circle, Video, FileType, Presentation, Image as ImageIcon,
  Link2, FileText, BookOpen, Download, ExternalLink,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useLearnerCourse, useLessonProgress, getAssetContent,
  type ContentKind, type LearnerLesson,
} from '@/lib/api/lms';

const KIND_ICON: Record<ContentKind, React.ElementType> = {
  VIDEO: Video, PPT: Presentation, SLIDE_DECK: Presentation, PDF: FileType, IMAGE: ImageIcon,
  SCORM: BookOpen, EXTERNAL_LINK: Link2, DOCUMENT_REF: FileText, RICH_TEXT: FileText,
};

// ── Viewer for a single lesson ──
function LessonViewer({
  lesson, onWatch, onComplete,
}: {
  lesson: LearnerLesson;
  onWatch: (seconds: number) => void;
  onComplete: () => void;
}) {
  // Fetch heavy file content lazily for uploaded assets (no direct URL).
  const needsAsset = !!lesson.asset_id && !lesson.asset_url &&
    ['VIDEO', 'PDF', 'PPT', 'SLIDE_DECK', 'IMAGE', 'SCORM'].includes(lesson.content_type);
  const { data: asset, isLoading } = useQuery({
    queryKey: ['lms', 'asset', lesson.asset_id],
    queryFn: () => getAssetContent(lesson.asset_id as string),
    enabled: needsAsset,
  });

  const src = lesson.asset_url ?? asset?.file_data ?? lesson.external_url ?? null;
  const lastReport = useRef(0);

  if (needsAsset && isLoading) {
    return <div className="flex justify-center py-20"><Spin /></div>;
  }

  switch (lesson.content_type) {
    case 'VIDEO':
      return src ? (
        <video
          key={lesson.id}
          src={src}
          controls
          className="w-full rounded-lg bg-black max-h-[60vh]"
          onTimeUpdate={(e) => {
            const t = Math.floor((e.target as HTMLVideoElement).currentTime);
            if (t - lastReport.current >= 10) { lastReport.current = t; onWatch(t); }
          }}
          onEnded={onComplete}
        />
      ) : <Empty description="No video source" />;

    case 'IMAGE':
      return src ? <img src={src} alt={lesson.title} className="max-w-full rounded-lg" /> : <Empty />;

    case 'PDF':
      return src ? (
        <iframe key={lesson.id} src={src} title={lesson.title} className="w-full rounded-lg border" style={{ height: '70vh' }} />
      ) : <Empty />;

    case 'PPT':
    case 'SLIDE_DECK':
      return (
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <Presentation size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-3">Slide deck — download to view, then mark complete.</p>
          {src && <a href={src} download className="inline-flex items-center gap-1 text-blue-600 text-sm"><Download size={14} /> Download</a>}
        </div>
      );

    case 'RICH_TEXT':
      return (
        <div className="prose prose-sm max-w-none rounded-lg border border-gray-200 p-5"
          dangerouslySetInnerHTML={{ __html: lesson.body_html ?? '' }} />
      );

    case 'EXTERNAL_LINK':
      return (
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <Link2 size={28} className="mx-auto text-gray-400 mb-2" />
          <a href={lesson.external_url ?? '#'} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 text-sm">
            <ExternalLink size={14} /> Open resource
          </a>
        </div>
      );

    case 'DOCUMENT_REF':
      return (
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <FileText size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-2">This lesson references a controlled document.</p>
          {lesson.document_id && (
            <a href={`/dms/${lesson.document_id}`} className="inline-flex items-center gap-1 text-blue-600 text-sm">
              <ExternalLink size={14} /> Open document
            </a>
          )}
        </div>
      );

    case 'SCORM':
      return (
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <BookOpen size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">SCORM package — interactive player coming in a later phase.</p>
          {src && <a href={src} download className="inline-flex items-center gap-1 text-blue-600 text-sm mt-2"><Download size={14} /> Download package</a>}
        </div>
      );

    default:
      return <Empty />;
  }
}

export default function CoursePlayerPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const { data, isLoading } = useLearnerCourse(id);
  const progress = useLessonProgress(id);

  const lessons = useMemo(
    () => data?.course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))) ?? [],
    [data],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Default to the first incomplete lesson once loaded.
  useEffect(() => {
    if (!activeId && lessons.length) {
      setActiveId(lessons.find((l) => !l.completed)?.id ?? lessons[0].id);
    }
  }, [lessons, activeId]);

  if (isLoading) return <PageContainer><div className="flex justify-center py-20"><Spin /></div></PageContainer>;
  if (!data) return <PageContainer><Empty description="Course not found" /></PageContainer>;

  const active = lessons.find((l) => l.id === activeId) ?? null;

  const markComplete = async (lessonId: string) => {
    try {
      await progress.mutateAsync({ lessonId, completed: true });
      message.success('Marked complete');
    } catch { message.error('Could not update progress'); }
  };
  const reportWatch = (lessonId: string, seconds: number) => {
    progress.mutate({ lessonId, seconds_viewed: seconds });
  };

  return (
    <PageContainer>
      <button onClick={() => nav('/lms/my')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> My Learning
      </button>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{data.course.title}</h1>
          <p className="text-[11px] font-mono text-gray-400">{data.course.code}</p>
        </div>
        <div className="flex items-center gap-3">
          {data.status === 'COMPLETED' && <Tag color="green" icon={<CheckCircle2 size={12} />}>Completed</Tag>}
          <div className="w-40"><Progress percent={data.progress_pct} size="small" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Lesson list */}
        <div className="rounded-xl border border-gray-200 bg-white p-2 h-fit">
          {data.course.modules.map((m, mi) => (
            <div key={m.id} className="mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 px-2 py-1">{mi + 1}. {m.title}</p>
              {m.lessons.map((l) => {
                const Icon = KIND_ICON[l.content_type];
                const isActive = l.id === activeId;
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveId(l.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
                    {l.completed
                      ? <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                      : <Circle size={15} className="text-gray-300 shrink-0" />}
                    <Icon size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{l.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Active lesson */}
        <div>
          {active ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-semibold text-gray-900">{active.title}</h2>
                {!active.is_mandatory && <span className="text-[11px] text-gray-400">optional</span>}
              </div>

              <LessonViewer
                lesson={active}
                onWatch={(s) => reportWatch(active.id, s)}
                onComplete={() => markComplete(active.id)}
              />

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-500">
                  {active.completed
                    ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={13} /> Completed</span>
                    : active.min_view_seconds
                      ? `Watch at least ${active.min_view_seconds}s to auto-complete`
                      : 'Review the content, then mark complete'}
                </div>
                {!active.completed && (
                  <Button type="primary" loading={progress.isPending} onClick={() => markComplete(active.id)}>
                    Mark complete
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Empty description="No lessons in this course yet." />
          )}

          {data.has_final_exam && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-amber-800">
                {data.progress_pct === 100
                  ? 'All lessons complete — pass the final exam to finish this course.'
                  : 'This course has a final exam. Complete the lessons, then take the exam to finish.'}
              </div>
              <Button type="primary" onClick={() => nav(`/lms/learn/${data.enrollment_id}/exam`)}>
                {data.status === 'COMPLETED' ? 'View exam' : 'Take final exam'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
