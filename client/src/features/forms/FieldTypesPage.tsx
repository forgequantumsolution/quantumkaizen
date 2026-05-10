// Lightweight admin for the FieldType registry. System types are read-only;
// custom types can be added/removed.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useCreateFieldType, useDeleteFieldType, useFieldTypes } from './hooks';

const DATA_TYPES = ['string', 'number', 'boolean', 'date', 'json', 'file'] as const;

export default function FieldTypesPage() {
  const nav = useNavigate();
  const { data: types = [], isLoading } = useFieldTypes();
  const create = useCreateFieldType();
  const remove = useDeleteFieldType();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [dataType, setDataType] = useState<string>('string');

  const handleCreate = async () => {
    if (!label.trim()) return;
    try {
      await create.mutateAsync({ label: label.trim(), description: description.trim(), data_type: dataType });
      toast.success('Field type added');
      setOpen(false);
      setLabel('');
      setDescription('');
      setDataType('string');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => nav('/forms')} className="mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to forms
      </Button>
      <PageHeader
        title="Field types"
        description="Built-in types are seeded by the system; add custom types to extend the form builder."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New field type
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Label</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Data type</th>
                <th className="text-left px-4 py-2 font-medium">Origin</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{t.label}</td>
                  <td className="px-4 py-2 text-slate-500"><code>{t.name}</code></td>
                  <td className="px-4 py-2 text-slate-500">{t.data_type ?? '—'}</td>
                  <td className="px-4 py-2">
                    {t.is_system ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                        <ShieldCheck className="h-3 w-3" /> System
                      </span>
                    ) : (
                      <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!t.is_system && (
                      <button
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => {
                          if (confirm(`Delete field type "${t.label}"?`)) {
                            remove.mutate(t.id, { onSuccess: () => toast.success('Deleted') });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New field type">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <Input value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data type</label>
            <Select
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              options={DATA_TYPES.map((d) => ({ value: d, label: d }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending || !label.trim()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
