/**
 * Online document editor (TipTap / ProseMirror) for the DMS.
 * Authors controlled-document content; emits HTML via onChange. Render read-only
 * (editable=false) to display an issued document. Keyed by version id at the call
 * site so switching documents remounts with fresh content.
 */
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
  Link2, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2,
  Table as TableIcon, Columns3, Rows3, Trash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder = 'Start writing the document…',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white',
        !editable && 'border-transparent bg-transparent',
      )}
    >
      {editable && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className={cn(
          'dms-doc px-6 py-5',
          editable ? 'min-h-[460px]' : 'min-h-0',
        )}
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const inTable = editor.isActive('table');
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1.5 sticky top-0 bg-white z-10 rounded-t-lg">
      <Btn on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={15} /></Btn>
      <Btn on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={15} /></Btn>
      <Btn on={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={15} /></Btn>
      <Btn on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={15} /></Btn>
      <Btn on={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code"><Code size={15} /></Btn>
      <Sep />
      <Btn on={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 size={15} /></Btn>
      <Btn on={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 size={15} /></Btn>
      <Btn on={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 size={15} /></Btn>
      <Sep />
      <Btn on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List size={15} /></Btn>
      <Btn on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={15} /></Btn>
      <Btn on={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote size={15} /></Btn>
      <Btn on={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></Btn>
      <Sep />
      <Btn on={editor.isActive('link')} onClick={setLink} title="Link"><Link2 size={15} /></Btn>
      <Sep />
      <Btn on={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left"><AlignLeft size={15} /></Btn>
      <Btn on={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center"><AlignCenter size={15} /></Btn>
      <Btn on={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right"><AlignRight size={15} /></Btn>
      <Sep />
      <Btn on={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 size={15} /></Btn>
      <Btn on={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 size={15} /></Btn>
      <Sep />
      <Btn on={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon size={15} /></Btn>
      {inTable && (
        <>
          <Btn on={false} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column"><Columns3 size={15} /></Btn>
          <Btn on={false} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row"><Rows3 size={15} /></Btn>
          <Btn on={false} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column"><Columns3 size={15} className="text-red-500" /></Btn>
          <Btn on={false} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row"><Rows3 size={15} className="text-red-500" /></Btn>
          <Btn on={false} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table"><Trash size={15} className="text-red-500" /></Btn>
        </>
      )}
    </div>
  );
}

function Btn({
  children, onClick, on, title, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  on: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        on ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100',
        disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-gray-200" />;
}
