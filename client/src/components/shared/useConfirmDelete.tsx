import { App, message } from 'antd';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteArgs {
  /** Entity label, singular, lowercase — used in title & toast (e.g. "audit master"). */
  entityLabel: string;
  /** Display name of the record being deleted (used in the modal body). */
  name: string;
  /** Optional extra warning shown under the main question. */
  extraWarning?: string;
  /** Async mutation runner — typically `() => deleteMut.mutateAsync(id)`. */
  mutate: () => Promise<unknown>;
  /** React Query key prefix to invalidate + refetch on success. */
  invalidateKey: QueryKey;
  /** Overrides for the success toast text. Defaults to `${entityLabel} deleted`. */
  successMessage?: string;
}

/**
 * Reusable confirm-delete flow: centered Antd modal → mutate → await query
 * invalidation → success toast. Error toasts are shown automatically.
 *
 * Usage:
 *   const confirmDelete = useConfirmDelete();
 *   confirmDelete({
 *     entityLabel: 'audit master',
 *     name: m.name,
 *     mutate: () => deleteMut.mutateAsync(m.id),
 *     invalidateKey: ['audit', 'masters'],
 *   });
 */
export function useConfirmDelete() {
  const { modal } = App.useApp();
  const qc = useQueryClient();

  return (args: ConfirmDeleteArgs) => {
    const titleText = `Delete ${args.entityLabel}`;
    const successText = args.successMessage ?? `${capitalize(args.entityLabel)} deleted`;

    modal.confirm({
      icon: null,
      title: null,
      width: 420,
      centered: true,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      className: 'qk-center-confirm',
      content: (
        <div className="flex flex-col items-center text-center px-2 py-1">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <Trash2 size={22} className="text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1.5">{titleText}</h3>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{args.name}</span>?
            <br />
            {args.extraWarning ?? 'This action cannot be undone.'}
          </p>
        </div>
      ),
      onOk: async () => {
        try {
          await args.mutate();
          await qc.invalidateQueries({ queryKey: args.invalidateKey, refetchType: 'active' });
          message.success(successText);
        } catch (err) {
          message.error(extractErr(err));
        }
      },
    });
  };
}

function capitalize(s: string) {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? 'Operation failed'
  );
}
