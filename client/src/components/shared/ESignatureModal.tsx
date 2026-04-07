import { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';

interface ESignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (password: string, meaning: string, comment: string) => void;
  entityType: string;
  entityId: string;
  isLoading?: boolean;
}

const signatureMeanings = [
  'Approved',
  'Reviewed',
  'Acknowledged',
  'Rejected',
  'Verified',
  'Authorized',
];

export default function ESignatureModal({
  isOpen,
  onClose,
  onSign,
  entityType,
  entityId,
  isLoading,
}: ESignatureModalProps) {
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState('Approved');
  const [comment, setComment] = useState('');

  const handleSign = () => {
    if (!password) return;
    onSign(password, meaning, comment);
    setPassword('');
    setComment('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Electronic Signature"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSign} isLoading={isLoading} disabled={!password}>
            <ShieldCheck size={15} />
            Apply Signature
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Legal notice */}
        <div className="flex gap-3 bg-amber-50 border border-amber-200/60 rounded-lg p-3.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong className="font-semibold">Legal notice:</strong> This is a legally binding electronic signature
            equivalent to a handwritten signature under 21 CFR Part 11.
          </p>
        </div>

        {/* Context */}
        <div className="bg-surface-secondary rounded-lg p-3.5">
          <p className="text-xs text-gray-500">
            Signing <span className="font-medium text-gray-700">{entityType}</span>
            <span className="font-mono text-mono-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1.5">{entityId}</span>
          </p>
        </div>

        {/* Meaning */}
        <div>
          <label className="label label-required">Meaning of Signature</label>
          <select
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            className="input-base"
          >
            {signatureMeanings.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Password */}
        <div>
          <label className="label label-required">Re-enter Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your identity"
            className="input-base"
          />
        </div>

        {/* Comment */}
        <div>
          <label className="label">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            rows={2}
            className="input-base h-auto min-h-[64px] py-2.5 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
