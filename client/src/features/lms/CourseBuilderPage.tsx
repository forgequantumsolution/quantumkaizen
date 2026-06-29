import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App, Button, Collapse, Empty, Input, InputNumber, Modal, Select, Spin, Switch, Tag, Upload,
} from 'antd';
import {
  ArrowLeft, Plus, Trash2, Send, ShieldCheck, GitBranch, Archive, FileText, Video, FileType, Link2, Presentation, Image as ImageIcon, BookOpen, FileQuestion,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import ESignatureModal from '@/components/shared/ESignatureModal';
import { useHasPermission } from '@/stores/authStore';
import { useDocuments } from '@/lib/api/dms';
import {
  useCourse, useAddModule, useDeleteModule, useAddLesson, useDeleteLesson,
  useSubmitCourse, usePublishCourse, useRetireCourse, useCreateVersion,
  createAsset,
  type ContentKind, type CourseStatus, type CreateLessonBody,
} from '@/lib/api/lms';

const STATUS_COLOR: Record<CourseStatus, string> = {
  DRAFT: 'default', IN_REVIEW: 'gold', PUBLISHED: 'green', RETIRED: 'red',
};

const KIND_ICON: Record<ContentKind, React.ElementType> = {
  VIDEO: Video, PPT: Presentation, SLIDE_DECK: Presentation, PDF: FileType, IMAGE: ImageIcon,
  SCORM: BookOpen, EXTERNAL_LINK: Link2, DOCUMENT_REF: FileText, RICH_TEXT: FileText,
};

const KIND_LABEL: Record<ContentKind, string> = {
  VIDEO: 'Video', PPT: 'PowerPoint', SLIDE_DECK: 'Slide Deck', PDF: 'PDF', IMAGE: 'Image',
  SCORM: 'SCORM package', EXTERNAL_LINK: 'External link', DOCUMENT_REF: 'Controlled document', RICH_TEXT: 'Text / HTML',
};

// File kinds that upload a binary (stored as base64); others use a URL/ref/body.
const FILE_KINDS: ContentKind[] = ['VIDEO', 'PPT', 'SLIDE_DECK', 'PDF', 'IMAGE', 'SCORM'];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CourseBuilderPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const canWrite = useHasPermission('lms_course.write');
  const canPublish = useHasPermission('lms_course.publish');

  const { data: course, isLoading } = useCourse(id);
  const addModule = useAddModule(id);
  const deleteModule = useDeleteModule(id);
  const addLesson = useAddLesson(id);
  const deleteLesson = useDeleteLesson(id);
  const submit = useSubmitCourse(id);
  const publish = usePublishCourse(id);
  const retire = useRetireCourse(id);
  const createVersion = useCreateVersion(id);

  const [moduleOpen, setModuleOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [eSignOpen, setESignOpen] = useState(false);

  // lesson modal
  const [lessonModule, setLessonModule] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonKind, setLessonKind] = useState<ContentKind>('VIDEO');
  const [lessonUrl, setLessonUrl] = useState('');
  const [lessonBody, setLessonBody] = useState('');
  const [lessonDocId, setLessonDocId] = useState<string | undefined>();
  const [lessonMandatory, setLessonMandatory] = useState(true);
  const [lessonMinView, setLessonMinView] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  const { data: docs } = useDocuments();

  const editable = course?.status === 'DRAFT';

  const resetLesson = () => {
    setLessonTitle(''); setLessonKind('VIDEO'); setLessonUrl(''); setLessonBody('');
    setLessonDocId(undefined); setLessonMandatory(true); setLessonMinView(null); setPendingFile(null);
  };

  const openLessonModal = (moduleId: string) => { resetLesson(); setLessonModule(moduleId); };

  const saveLesson = async () => {
    if (!lessonModule) return;
    if (!lessonTitle.trim()) { message.error('Lesson title is required'); return; }
    setSavingLesson(true);
    try {
      const body: CreateLessonBody = {
        title: lessonTitle.trim(),
        content_type: lessonKind,
        is_mandatory: lessonMandatory,
        min_view_seconds: lessonMinView,
      };

      if (FILE_KINDS.includes(lessonKind)) {
        if (lessonKind === 'VIDEO' && lessonUrl.trim()) {
          // Video by URL — register an EXTERNAL/VIDEO asset pointing at the link.
          const asset = await createAsset({ kind: 'VIDEO', url: lessonUrl.trim(), title: lessonTitle.trim() });
          body.asset_id = asset.id;
        } else if (pendingFile) {
          const dataUrl = await readFileAsDataUrl(pendingFile);
          const asset = await createAsset({
            kind: lessonKind,
            title: pendingFile.name,
            file_data: dataUrl,
            mime_type: pendingFile.type || null,
            size_bytes: pendingFile.size,
          });
          body.asset_id = asset.id;
        } else {
          message.error(lessonKind === 'VIDEO' ? 'Upload a video file or paste a URL' : 'Upload a file');
          setSavingLesson(false);
          return;
        }
      } else if (lessonKind === 'EXTERNAL_LINK') {
        if (!lessonUrl.trim()) { message.error('Enter a URL'); setSavingLesson(false); return; }
        body.external_url = lessonUrl.trim();
      } else if (lessonKind === 'DOCUMENT_REF') {
        if (!lessonDocId) { message.error('Select a document'); setSavingLesson(false); return; }
        body.document_id = lessonDocId;
      } else if (lessonKind === 'RICH_TEXT') {
        body.body_html = lessonBody;
      }

      await addLesson.mutateAsync({ moduleId: lessonModule, body });
      message.success('Lesson added');
      setLessonModule(null);
      resetLesson();
    } catch {
      message.error('Failed to add lesson');
    } finally {
      setSavingLesson(false);
    }
  };

  const onAddModule = async () => {
    if (!moduleTitle.trim()) { message.error('Module title is required'); return; }
    try {
      await addModule.mutateAsync({ title: moduleTitle.trim() });
      setModuleOpen(false); setModuleTitle('');
    } catch { message.error('Failed to add module'); }
  };

  const onSubmit = async () => {
    try { await submit.mutateAsync(); message.success('Submitted for review'); }
    catch { message.error('Could not submit (add a module first?)'); }
  };

  const onPublish = async (password: string, meaning: string) => {
    try {
      await publish.mutateAsync({ credential: password, meaning });
      message.success('Course published');
      setESignOpen(false);
    } catch { message.error('Publish failed — check your signature credential'); }
  };

  const onNewVersion = async () => {
    try {
      const v = await createVersion.mutateAsync();
      message.success(`Draft v${v.version} created`);
      nav(`/lms/admin/courses/${v.id}`);
    } catch { message.error('Could not create a new version'); }
  };

  if (isLoading) return <PageContainer><div className="flex justify-center py-20"><Spin /></div></PageContainer>;
  if (!course) return <PageContainer><Empty description="Course not found" /></PageContainer>;

  return (
    <PageContainer>
      <button onClick={() => nav('/lms/admin/courses')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to courses
      </button>

      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <Tag color={STATUS_COLOR[course.status]}>{course.status.replace('_', ' ')}</Tag>
            <span className="font-mono text-xs text-gray-400">{course.code} v{course.version}</span>
          </div>
          {course.description && <p className="text-sm text-gray-500 mt-1 max-w-2xl">{course.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<FileQuestion size={14} />} onClick={() => nav(`/lms/admin/courses/${id}/exam`)}>Exam</Button>
          {editable && canWrite && (
            <Button icon={<Send size={14} />} onClick={onSubmit} loading={submit.isPending}>Submit for review</Button>
          )}
          {course.status === 'IN_REVIEW' && canPublish && (
            <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => setESignOpen(true)}>Publish (e-sign)</Button>
          )}
          {course.status === 'PUBLISHED' && canWrite && (
            <Button icon={<GitBranch size={14} />} onClick={onNewVersion} loading={createVersion.isPending}>New version</Button>
          )}
          {course.status === 'PUBLISHED' && canPublish && (
            <Button danger icon={<Archive size={14} />} onClick={() => retire.mutate()} loading={retire.isPending}>Retire</Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Curriculum — modules &amp; lessons</h2>
        {editable && canWrite && (
          <Button size="small" icon={<Plus size={13} />} onClick={() => setModuleOpen(true)}>Add module</Button>
        )}
      </div>

      {course.modules.length === 0 ? (
        <Empty description={editable ? 'No modules yet — add one to start building.' : 'No content.'} />
      ) : (
        <Collapse
          defaultActiveKey={course.modules.map((m) => m.id)}
          items={course.modules.map((m, mi) => ({
            key: m.id,
            label: (
              <div className="flex items-center justify-between pr-2">
                <span className="font-medium">{mi + 1}. {m.title}</span>
                <span className="text-xs text-gray-400">{m.lessons.length} lessons</span>
              </div>
            ),
            extra: editable && canWrite ? (
              <Trash2
                size={14}
                className="text-gray-400 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); deleteModule.mutate(m.id); }}
              />
            ) : undefined,
            children: (
              <div className="space-y-1.5">
                {m.lessons.map((l, li) => {
                  const Icon = KIND_ICON[l.content_type];
                  return (
                    <div key={l.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-5">{li + 1}</span>
                      <Icon size={15} className="text-gray-500 shrink-0" />
                      <span className="flex-1 text-sm">{l.title}</span>
                      <Tag>{KIND_LABEL[l.content_type]}</Tag>
                      {!l.is_mandatory && <span className="text-[11px] text-gray-400">optional</span>}
                      {editable && canWrite && (
                        <Trash2 size={13} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => deleteLesson.mutate(l.id)} />
                      )}
                    </div>
                  );
                })}
                {editable && canWrite && (
                  <Button type="dashed" size="small" icon={<Plus size={13} />} onClick={() => openLessonModal(m.id)} className="mt-1">
                    Add lesson
                  </Button>
                )}
              </div>
            ),
          }))}
        />
      )}

      {/* Add module modal */}
      <Modal title="Add module" open={moduleOpen} onCancel={() => setModuleOpen(false)} onOk={onAddModule} okText="Add" confirmLoading={addModule.isPending}>
        <label className="text-xs font-medium text-gray-600">Module title</label>
        <Input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="e.g. Introduction" />
      </Modal>

      {/* Add lesson modal */}
      <Modal
        title="Add lesson"
        open={!!lessonModule}
        onCancel={() => setLessonModule(null)}
        onOk={saveLesson}
        okText="Add lesson"
        confirmLoading={savingLesson}
        width={560}
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-gray-600">Lesson title *</label>
            <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Content type</label>
            <Select
              value={lessonKind}
              onChange={(v) => { setLessonKind(v); setPendingFile(null); setLessonUrl(''); }}
              style={{ width: '100%' }}
              options={(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            />
          </div>

          {lessonKind === 'VIDEO' && (
            <div>
              <label className="text-xs font-medium text-gray-600">Video URL (YouTube/Vimeo/CDN) — or upload below</label>
              <Input value={lessonUrl} onChange={(e) => setLessonUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}

          {FILE_KINDS.includes(lessonKind) && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Upload {KIND_LABEL[lessonKind]} {lessonKind === 'VIDEO' ? '(optional if URL given)' : ''}
              </label>
              <Upload
                beforeUpload={(file) => { setPendingFile(file); return false; }}
                maxCount={1}
                onRemove={() => setPendingFile(null)}
                fileList={pendingFile ? [{ uid: '1', name: pendingFile.name } as never] : []}
              >
                <Button icon={<Plus size={13} />}>Select file</Button>
              </Upload>
            </div>
          )}

          {lessonKind === 'EXTERNAL_LINK' && (
            <div>
              <label className="text-xs font-medium text-gray-600">Link URL</label>
              <Input value={lessonUrl} onChange={(e) => setLessonUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}

          {lessonKind === 'DOCUMENT_REF' && (
            <div>
              <label className="text-xs font-medium text-gray-600">Controlled document</label>
              <Select
                showSearch
                value={lessonDocId}
                onChange={setLessonDocId}
                style={{ width: '100%' }}
                placeholder="Select a document"
                optionFilterProp="label"
                options={(docs?.data ?? []).map((d) => ({ value: d.id, label: `${d.doc_number} — ${d.title}` }))}
              />
            </div>
          )}

          {lessonKind === 'RICH_TEXT' && (
            <div>
              <label className="text-xs font-medium text-gray-600">Content (HTML allowed)</label>
              <Input.TextArea value={lessonBody} onChange={(e) => setLessonBody(e.target.value)} rows={5} />
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={lessonMandatory} onChange={setLessonMandatory} size="small" />
              <span className="text-xs text-gray-600">Mandatory</span>
            </div>
            {lessonKind === 'VIDEO' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Min watch (sec)</span>
                <InputNumber size="small" min={0} value={lessonMinView ?? undefined} onChange={(v) => setLessonMinView(v ?? null)} />
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ESignatureModal
        isOpen={eSignOpen}
        onClose={() => setESignOpen(false)}
        onSign={(password, meaning) => onPublish(password, meaning)}
        entityType="LmsCourse"
        entityId={course.id}
        isLoading={publish.isPending}
      />
    </PageContainer>
  );
}
