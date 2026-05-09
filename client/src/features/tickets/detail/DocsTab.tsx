import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Modal, Select, Spinner } from '@/components/ui';
import { useAttachDoc, useDeleteDoc, useTicketDocs, type TicketDoc } from '@/lib/api/ticket';

const DOC_TYPES: { value: TicketDoc['docType']; label: string }[] = [
  { value: 'ATTACHMENT', label: 'Attachment' },
  { value: 'EVIDENCE', label: 'Evidence' },
  { value: 'REPORT', label: 'Report' },
  { value: 'FORM_SUBMISSION', label: 'Form submission' },
  { value: 'OTHER', label: 'Other' },
];

const formatBytes = (n: number | null) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export default function DocsTab({ ticketId, canUpdate }: { ticketId: string; canUpdate: boolean }) {
  const { data: docs = [], isLoading, error } = useTicketDocs(ticketId);
  const attach = useAttachDoc(ticketId);
  const remove = useDeleteDoc(ticketId);
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [docType, setDocType] = useState<TicketDoc['docType']>('ATTACHMENT');

  const handleAttach = async () => {
    if (!fileUrl.trim() || !fileName.trim()) return toast.error('URL and name required');
    try {
      await attach.mutateAsync({
        fileUrl: fileUrl.trim(),
        fileName: fileName.trim(),
        docType,
      });
      toast.success('Document attached');
      setOpen(false);
      setFileUrl('');
      setFileName('');
      setDocType('ATTACHMENT');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to attach';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Document removed');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  return (
    <>
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
          {canUpdate && (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} />
              <span className="ml-1">Attach</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load documents.</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">No documents yet.</p>
        ) : (
          <ul className="space-y-1">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 rounded border border-gray-100 hover:bg-gray-50"
              >
                <FileText size={14} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {d.docType.toLowerCase().replace('_', ' ')}
                    {d.fileSizeBytes && ` · ${formatBytes(d.fileSizeBytes)}`}
                    {d.uploadedBy && ` · ${d.uploadedBy.name}`}
                  </p>
                </div>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600"
                  aria-label="open document"
                >
                  <ExternalLink size={14} />
                </a>
                {canUpdate && (
                  <button
                    onClick={() => handleDelete(d.id, d.fileName)}
                    className="text-gray-400 hover:text-red-500"
                    aria-label="delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Attach Document"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAttach}
              isLoading={attach.isPending}
              disabled={attach.isPending || !fileUrl.trim() || !fileName.trim()}
            >
              Attach
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">File URL</label>
            <Input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://example.com/document.pdf"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">File name</label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="audit-report.pdf"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value as TicketDoc['docType'])}
              options={DOC_TYPES}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
