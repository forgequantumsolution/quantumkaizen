// Tabular layout for the fields of a single section. Each row exposes the
// most-used controls inline (label, key, required, width, indicators); the
// gear in the actions column expands a settings panel below the row.
import { Plus, ListPlus } from 'lucide-react';
import { Button as AntButton } from 'antd';
import AddFieldPopover from './AddFieldPopover';
import FieldTableRow from './FieldTableRow';
import type { ParentField } from './DependencyEditor';
import type { FieldType, FormFieldDef } from '../types';

interface Props {
  fields: FormFieldDef[];
  fieldTypes: FieldType[];
  parentsFor: (fieldId?: string) => ParentField[];
  onChangeField: (fieldId: string, patch: Partial<FormFieldDef>) => void;
  onMoveField: (fieldId: string, dir: -1 | 1) => void;
  onDuplicateField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onAddField: (atIndex: number, type: FieldType) => void;
  hiddenFieldIds: Set<string>;
  // When true, "Add field" just appends a row with the first available type;
  // the row's Type column becomes a dropdown so the user can change it inline.
  inlineTypePicker?: boolean;
}

export default function FieldTable({
  fields, fieldTypes, parentsFor,
  onChangeField, onMoveField, onDuplicateField, onRemoveField, onAddField,
  hiddenFieldIds, inlineTypePicker = false,
}: Props) {
  const defaultType = fieldTypes[0];

  const inlineAddBtn = (label: string) => (
    <AntButton
      type="primary"
      icon={<Plus className="h-4 w-4" />}
      onClick={() => defaultType && onAddField(fields.length, defaultType)}
      disabled={!defaultType}
    >
      {label}
    </AntButton>
  );
  if (fields.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-10 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
          <ListPlus className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-slate-700 mb-1">No fields in this section yet</p>
        <p className="text-xs text-slate-500 mb-4">
          {inlineTypePicker
            ? 'Click below to add a row, then choose its type from the dropdown.'
            : 'Pick a field type to add the first row to this section.'}
        </p>
        {inlineTypePicker ? (
          inlineAddBtn('Add first field')
        ) : (
          <AddFieldPopover
            fieldTypes={fieldTypes}
            variant="big"
            label="Add first field"
            onPick={(t) => onAddField(0, t)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold w-10">#</th>
              <th className="px-3 py-2 font-semibold w-44">Type</th>
              <th className="px-3 py-2 font-semibold">Label</th>
              <th className="px-3 py-2 font-semibold hidden md:table-cell w-44">Field key</th>
              <th className="px-3 py-2 font-semibold w-16 text-center">Req</th>
              <th className="px-3 py-2 font-semibold hidden lg:table-cell w-28">Width</th>
              <th className="px-3 py-2 font-semibold hidden lg:table-cell w-32">Rules</th>
              <th className="px-3 py-2 font-semibold w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, idx) => (
              <FieldTableRow
                key={f.field_id}
                field={f}
                index={idx}
                total={fields.length}
                parents={parentsFor(f.field_id)}
                fieldTypes={fieldTypes}
                inlineTypePicker={inlineTypePicker}
                onChange={(patch) => onChangeField(f.field_id ?? '', patch)}
                onMoveUp={() => onMoveField(f.field_id ?? '', -1)}
                onMoveDown={() => onMoveField(f.field_id ?? '', 1)}
                onDuplicate={() => onDuplicateField(f.field_id ?? '')}
                onRemove={() => onRemoveField(f.field_id ?? '')}
                hidden={hiddenFieldIds.has(f.field_id ?? '')}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {fields.length} field{fields.length === 1 ? '' : 's'}
        </p>
        {inlineTypePicker ? (
          inlineAddBtn('Add field')
        ) : (
          <AddFieldPopover
            fieldTypes={fieldTypes}
            variant="big"
            label="Add field"
            onPick={(t) => onAddField(fields.length, t)}
          />
        )}
      </div>
    </div>
  );
}

// keep the import used
export { Plus };
