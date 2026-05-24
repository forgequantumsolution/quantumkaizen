import { useCallback, useId, useMemo, useRef, useState } from 'react';
import {
  Upload as UploadIcon,
  Image as ImageIcon,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react';

export interface UploadedFileMeta {
  name: string;
  size?: number;
  type?: string;
  uid?: string;
  /** Base64 data URL for image previews when kind === 'image'. */
  preview?: string;
}

interface Props {
  value: UploadedFileMeta | null | undefined;
  onChange: (v: UploadedFileMeta | null) => void;
  disabled?: boolean;
  kind: 'file' | 'image';
  /** Comma-separated list of allowed extensions, e.g. ".pdf,.docx,.png" */
  allowedExtensions?: string;
  /** Max file size in megabytes. */
  maxSizeMb?: number;
  placeholder?: string;
}

const formatBytes = (n: number | undefined) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const normaliseExts = (raw?: string): string[] =>
  (raw ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.startsWith('.') ? s : `.${s}`));

const IMAGE_ACCEPT = 'image/*';

export default function FileUploadField({
  value,
  onChange,
  disabled,
  kind,
  allowedExtensions,
  maxSizeMb,
  placeholder,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const allowedList = useMemo(
    () => (kind === 'image' && !allowedExtensions
      ? ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
      : normaliseExts(allowedExtensions)),
    [allowedExtensions, kind],
  );

  const acceptAttr = useMemo(() => {
    if (allowedList.length) return allowedList.join(',');
    return kind === 'image' ? IMAGE_ACCEPT : undefined;
  }, [allowedList, kind]);

  const validate = useCallback(
    (file: File): string | null => {
      if (allowedList.length) {
        const lower = file.name.toLowerCase();
        const ok = allowedList.some((ext) => lower.endsWith(ext));
        if (!ok) {
          return `Only ${allowedList.join(', ')} files are allowed`;
        }
      }
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        return `File is ${formatBytes(file.size)} — max allowed is ${maxSizeMb} MB`;
      }
      return null;
    },
    [allowedList, maxSizeMb],
  );

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setInternalError(err);
        return;
      }
      setInternalError(null);
      const meta: UploadedFileMeta = {
        name: file.name,
        size: file.size,
        type: file.type,
        uid: `${file.name}-${file.size}-${Date.now()}`,
      };
      if (kind === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onChange({ ...meta, preview: String(reader.result ?? '') });
        };
        reader.onerror = () => onChange(meta);
        reader.readAsDataURL(file);
      } else {
        onChange(meta);
      }
    },
    [kind, onChange, validate],
  );

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // reset so the same file can be picked again after removal
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const clear = () => {
    setInternalError(null);
    onChange(null);
  };

  const hintParts: string[] = [];
  if (allowedList.length) hintParts.push(allowedList.join(', '));
  if (maxSizeMb) hintParts.push(`up to ${maxSizeMb} MB`);
  const hint = hintParts.join(' · ');

  // ── Has a file: show preview/summary card ─────────────────────
  if (value) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 pr-3">
          {kind === 'image' && value.preview ? (
            <img
              src={value.preview}
              alt={value.name}
              className="h-12 w-12 rounded object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-50 border border-slate-200 text-slate-500">
              {kind === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{value.name}</p>
            <p className="text-xs text-slate-500">
              {[value.type, formatBytes(value.size)].filter(Boolean).join(' · ')}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
          >
            Replace {kind === 'image' ? 'image' : 'file'}
          </button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="hidden"
          accept={acceptAttr}
          onChange={onPicked}
          disabled={disabled}
        />
        {internalError && (
          <p className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {internalError}
          </p>
        )}
      </div>
    );
  }

  // ── Empty: drop zone ──────────────────────────────────────────
  const Icon = kind === 'image' ? ImageIcon : UploadIcon;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors',
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
            : dragOver
              ? 'cursor-pointer border-indigo-400 bg-indigo-50/60 text-indigo-700'
              : 'cursor-pointer border-slate-300 bg-slate-50/50 text-slate-600 hover:border-slate-400 hover:bg-slate-50',
        ].join(' ')}
      >
        <Icon size={20} className="opacity-80" />
        <div className="text-sm">
          <span className="font-medium">
            {placeholder ??
              (kind === 'image' ? 'Drop image or click to browse' : 'Drop file or click to browse')}
          </span>
        </div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        accept={acceptAttr}
        onChange={onPicked}
        disabled={disabled}
      />
      {internalError && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {internalError}
        </p>
      )}
    </div>
  );
}
