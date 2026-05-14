/**
 * Modal: request an SLA timer extension.
 *
 * The request is recorded as `SlaExtension(status=PENDING)` on the backend.
 * An admin (with `sla.timer.extend.approve`) approves via the separate
 * `/api/sla/extensions/:id/decide` endpoint; only on APPROVAL does the
 * timer's `deadline` shift.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { useRequestExtension } from '@/lib/api/sla';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  timerId: string;
}

export default function SlaExtendModal({ isOpen, onClose, timerId }: Props) {
  const [hours, setHours] = useState('1');
  const [reason, setReason] = useState('');
  const request = useRequestExtension(timerId);

  const submit = async () => {
    const hoursNum = Number(hours);
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) {
      toast.error('Enter a positive number of hours');
      return;
    }
    if (reason.trim().length < 1) {
      toast.error('Reason is required');
      return;
    }
    try {
      await request.mutateAsync({
        extensionSec: Math.round(hoursNum * 3600),
        reason: reason.trim(),
      });
      toast.success('Extension requested — pending admin approval');
      setHours('1');
      setReason('');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to request extension';
      toast.error(msg);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request SLA extension">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700">Hours</label>
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700">Reason</label>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this extension needed?"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            isLoading={request.isPending}
            disabled={request.isPending}
          >
            Submit request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
