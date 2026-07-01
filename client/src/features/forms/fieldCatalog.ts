// Categorisation + iconography for the 21 built-in field types the backend seeds.
// Keys match FieldType.name from the API; unknown server-side field types fall
// back to a generic input.
import {
  Type, Hash, AlignLeft, Lock, CheckSquare, Circle, ChevronDown, List,
  Calendar, CalendarRange, Clock, Clock4, Upload, Image as ImageIcon,
  ToggleLeft, SlidersHorizontal, Minus, Palette, PenLine, FileText, Table,
  ShieldCheck,
} from 'lucide-react';

export type FieldGroup = 'basic' | 'choice' | 'datetime' | 'media' | 'advanced';

export const FIELD_CATALOG: Record<
  string,
  { icon: React.ElementType; group: FieldGroup; defaultLabel: string }
> = {
  text:        { icon: Type,            group: 'basic',    defaultLabel: 'Text' },
  number:      { icon: Hash,            group: 'basic',    defaultLabel: 'Number' },
  textarea:    { icon: AlignLeft,       group: 'basic',    defaultLabel: 'Long Text' },
  password:    { icon: Lock,            group: 'basic',    defaultLabel: 'Password' },
  multi_text:  { icon: List,            group: 'basic',    defaultLabel: 'Multi Text' },

  checkbox:    { icon: CheckSquare,     group: 'choice',   defaultLabel: 'Checkbox Group' },
  radio:       { icon: Circle,          group: 'choice',   defaultLabel: 'Radio Group' },
  select:      { icon: ChevronDown,     group: 'choice',   defaultLabel: 'Dropdown' },
  switch:      { icon: ToggleLeft,      group: 'choice',   defaultLabel: 'Toggle' },
  // Audit checklist disposition — fixed vocabulary, aggregated into the
  // Non-Conformance tab when the audit ticket closes (see audit-compliance-sync).
  compliance:  { icon: ShieldCheck,     group: 'choice',   defaultLabel: 'Compliance Result' },

  date:        { icon: Calendar,        group: 'datetime', defaultLabel: 'Date' },
  date_range:  { icon: CalendarRange,   group: 'datetime', defaultLabel: 'Date Range' },
  time:        { icon: Clock,           group: 'datetime', defaultLabel: 'Time' },
  time_range:  { icon: Clock4,          group: 'datetime', defaultLabel: 'Time Range' },

  file:        { icon: Upload,          group: 'media',    defaultLabel: 'File Upload' },
  image:       { icon: ImageIcon,       group: 'media',    defaultLabel: 'Image Upload' },
  signature:   { icon: PenLine,         group: 'media',    defaultLabel: 'Signature' },
  color:       { icon: Palette,         group: 'media',    defaultLabel: 'Color' },

  slider:      { icon: SlidersHorizontal, group: 'advanced', defaultLabel: 'Slider' },
  range:       { icon: Minus,           group: 'advanced', defaultLabel: 'Number Range' },
  richtext:    { icon: FileText,        group: 'advanced', defaultLabel: 'Rich Text' },
  table:       { icon: Table,           group: 'advanced', defaultLabel: 'Table' },
};

export const GROUP_LABELS: Record<FieldGroup, string> = {
  basic: 'Basic',
  choice: 'Choice',
  datetime: 'Date & Time',
  media: 'Media',
  advanced: 'Advanced',
};

export const fieldUsesOptions = (typeName: string | null | undefined) =>
  typeName ? ['checkbox', 'radio', 'select'].includes(typeName) : false;

export const fieldIsTable = (typeName: string | null | undefined) =>
  typeName === 'table';

export const fieldIsCompliance = (typeName: string | null | undefined) =>
  typeName === 'compliance';

// Fixed audit disposition vocabulary. `value` is what gets stored in the
// submission JSON (kept stable — the backend matches on these exact strings);
// `label`/`color` are display-only. NON_CONFORMANCE / OBSERVATION are the two
// that roll up into the Non-Conformance tab on ticket close.
export const COMPLIANCE_OPTIONS: {
  value: 'COMPLIANT' | 'NON_CONFORMANCE' | 'OBSERVATION' | 'NOT_APPLICABLE';
  label: string;
  color: string;
}[] = [
  { value: 'COMPLIANT', label: 'Compliant', color: '#16a34a' },
  { value: 'NON_CONFORMANCE', label: 'Non-Conformance', color: '#dc2626' },
  { value: 'OBSERVATION', label: 'Observation', color: '#d97706' },
  { value: 'NOT_APPLICABLE', label: 'N/A', color: '#64748b' },
];
