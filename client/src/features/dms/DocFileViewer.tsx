import { FileText, Download } from 'lucide-react';

interface Props {
  fileName: string | null;
  fileMime: string | null;
  fileSize?: number | null;
  /** Base64 data URL ("data:<mime>;base64,…"). */
  fileData: string | null | undefined;
}

const fmtSize = (n?: number | null) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export default function DocFileViewer({ fileName, fileMime, fileSize, fileData }: Props) {
  if (!fileData) {
    return <div className="py-8 text-center text-sm text-gray-400">No file uploaded.</div>;
  }
  const isPdf = (fileMime ?? '').includes('pdf') || (fileName ?? '').toLowerCase().endsWith('.pdf');
  const isImage = (fileMime ?? '').startsWith('image/');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <FileText size={16} className="text-gray-500 shrink-0" />
        <span className="font-medium text-gray-800 truncate">{fileName ?? 'Document file'}</span>
        {fileSize ? <span className="text-xs text-gray-400">· {fmtSize(fileSize)}</span> : null}
        <a
          href={fileData}
          download={fileName ?? 'document'}
          className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Download size={13} /> Download
        </a>
      </div>

      {isPdf ? (
        <iframe
          title={fileName ?? 'document'}
          src={fileData}
          className="w-full h-[640px] rounded-lg border border-gray-200 bg-white"
        />
      ) : isImage ? (
        <img
          src={fileData}
          alt={fileName ?? 'document'}
          className="max-w-full rounded-lg border border-gray-200"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Preview not available for this file type — use Download to open it.
        </div>
      )}
    </div>
  );
}
