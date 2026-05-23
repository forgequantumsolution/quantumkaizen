import { Modal } from '@/components/ui';
import SlaPanel from './SlaPanel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
}

export default function SlaModal({ isOpen, onClose, ticketId }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SLA" size="lg">
      <SlaPanel ticketId={ticketId} />
    </Modal>
  );
}
