import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Segmented, Select, Spin, message } from 'antd';
import { ArrowLeft, Save, GitBranch, Upload, FileText, PenLine } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import {
  useDocument,
  useCreateDocument,
  useUpdateDocument,
  useSaveContent,
  useReviseDocument,
  DOC_TYPE_LABELS,
  type DocumentType,
  type DocContentType,
} from '@/lib/api/dms';
import RichTextEditor from './RichTextEditor';
import DocFileViewer from './DocFileViewer';
import DocStatusBadge from './DocStatusBadge';

const TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS).map(([v, label]) => ({ value: v, label }));
const MAX_FILE = 8 * 1024 * 1024;

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isCreate = !id;
  const nav = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: doc, isLoading } = useDocument(id);
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const users = usersData?.items ?? [];
  const { data: deptData } = useDepartments({ pageSize: 200 });
  const depts = deptData?.items ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('SOP');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [description, setDescription] = useState('');

  const [mode, setMode] = useState<DocContentType>('EDITOR');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(isCreate);

  useEffect(() => {
    if (!isCreate && doc && !hydrated) {
      setTitle(doc.title);
      setType(doc.type);
      setOwnerId(doc.owner_id ?? undefined);
      setDepartmentId(doc.department_id ?? undefined);
      setDescription(doc.description ?? '');
      const v = doc.working_version ?? doc.current_version;
      setMode(v?.content_type ?? 'EDITOR');
      setContent(v?.content ?? '');
      setFileName(v?.file_name ?? null);
      setFileMime(v?.file_mime ?? null);
      setFileSize(v?.file_size ?? null);
      setFileData(v?.file_data ?? null);
      setHydrated(true);
    }
  }, [isCreate, doc, hydrated]);

  const createMut = useCreateDocument();
  const updateMut = useUpdateDocument(id ?? '');
  const saveMut = useSaveContent(id ?? '');
  const reviseMut = useReviseDocument(id ?? '');

  const working = doc?.working_version ?? null;
  const editable = isCreate || !!working;

  const onPickFile = (file: File) => {
    if (file.size > MAX_FILE) {
      message.error('File must be 8 MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
      setFileMime(file.type || null);
      setFileSize(file.size);
    };
    reader.readAsDataURL(file);
  };

  const contentPayload = () =>
    mode === 'FILE'
      ? { content_type: 'FILE' as const, file_name: fileName, file_mime: fileMime, file_size: fileSize, file_data: fileData }
      : { content_type: 'EDITOR' as const, content };

  const handleCreate = async () => {
    if (!title.trim()) return message.error('Title is required');
    if (mode === 'FILE' && !fileData) return message.error('Choose a file to upload');
    try {
      const created = await createMut.mutateAsync({
        title: title.trim(),
        type,
        description: description || null,
        owner_id: ownerId ?? null,
        department_id: departmentId ?? null,
        ...contentPayload(),
      });
      message.success('Document created');
      nav(`/dms/${created.id}/edit`);
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  const handleSave = async () => {
    if (!id) return;
    if (mode === 'FILE' && !fileData) return message.error('Choose a file to upload');
    try {
      await updateMut.mutateAsync({
        title: title.trim(),
        type,
        description: description || null,
        owner_id: ownerId ?? null,
        department_id: departmentId ?? null,
      });
      await saveMut.mutateAsync(contentPayload());
      message.success('Saved');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  const handleRevise = async () => {
    if (!id) return;
    try {
      await reviseMut.mutateAsync({});
      setHydrated(false);
      message.success('New draft revision started');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  if (!isCreate && isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32"><Spin /></div>
      </PageContainer>
    );
  }

  const backTo = isCreate ? '/dms' : `/dms/${id}`;

  return (
    <PageContainer>
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="text-gray-300">·</span>
          {isCreate ? (
            <h2 className="text-base font-semibold text-gray-900">New Document</h2>
          ) : (
            <>
              <span className="font-mono text-sm text-gray-700">{doc?.doc_number}</span>
              {doc && <DocStatusBadge status={doc.status} />}
              {working && <span className="text-[11px] text-gray-400">editing v{working.version_label}</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => nav(backTo)}>Cancel</Button>
          {isCreate ? (
            <Button type="primary" icon={<Save size={14} />} onClick={handleCreate} loading={createMut.isPending}>
              Create Document
            </Button>
          ) : editable ? (
            <Button type="primary" icon={<Save size={14} />} onClick={handleSave} loading={updateMut.isPending || saveMut.isPending}>
              Save Draft
            </Button>
          ) : (
            <Button icon={<GitBranch size={14} />} onClick={handleRevise} loading={reviseMut.isPending}>
              Revise to edit
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 grid grid-cols-1 md:grid-cols-12 gap-3">
        <Field label="Title *" className="md:col-span-6">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} placeholder="e.g. Sampling of Raw Materials" />
        </Field>
        <Field label="Type" className="md:col-span-2">
          <Select value={type} onChange={(v) => setType(v)} options={TYPE_OPTIONS} disabled={!editable} className="w-full" />
        </Field>
        <Field label="Owner" className="md:col-span-2">
          <Select value={ownerId} onChange={setOwnerId} allowClear showSearch optionFilterProp="label" placeholder="Owner" disabled={!editable} className="w-full" options={users.map((u) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="Department" className="md:col-span-2">
          <Select value={departmentId} onChange={setDepartmentId} allowClear showSearch optionFilterProp="label" placeholder="Department" disabled={!editable} className="w-full" options={depts.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="Description" className="md:col-span-12">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} placeholder="Short purpose / scope" />
        </Field>
      </div>

      {!editable && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          This version is effective and locked. Click <strong>Revise to edit</strong> to start a new draft.
        </div>
      )}

      {/* Authoring mode toggle */}
      {editable && (
        <div className="mb-3">
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as DocContentType)}
            options={[
              { value: 'EDITOR', label: <span className="inline-flex items-center gap-1.5"><PenLine size={13} /> Online Editor</span> },
              { value: 'FILE', label: <span className="inline-flex items-center gap-1.5"><Upload size={13} /> Upload File</span> },
            ]}
          />
        </div>
      )}

      {/* Content */}
      {mode === 'EDITOR' ? (
        <RichTextEditor
          key={`${isCreate ? 'new' : working?.id ?? doc?.current_version_id ?? 'view'}-editor`}
          value={content}
          onChange={setContent}
          editable={editable}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {editable && (
            <div className="flex items-center gap-2 mb-4">
              <Button icon={<Upload size={14} />} onClick={() => fileInput.current?.click()}>
                {fileData ? 'Replace file' : 'Choose file…'}
              </Button>
              <span className="text-xs text-gray-400">PDF, Word, images — up to 8 MB</span>
            </div>
          )}
          {fileData ? (
            <DocFileViewer fileName={fileName} fileMime={fileMime} fileSize={fileSize} fileData={fileData} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <FileText size={28} />
              <span className="text-sm">No file uploaded yet.</span>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Operation failed'
  );
}
