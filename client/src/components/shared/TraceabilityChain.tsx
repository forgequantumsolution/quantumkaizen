import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Shield, MessageSquareWarning, ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TraceItem {
  id: string;
  type: 'NC' | 'CAPA' | 'Risk' | 'Complaint' | 'ChangeRequest';
  number: string;
  title: string;
  status: string;
  link: string;
}

interface TraceabilityChainProps {
  items: TraceItem[];
  currentId: string;
}

const TYPE_CONFIG = {
  NC: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200', label: 'NC' },
  CAPA: { icon: CheckCircle2, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'CAPA' },
  Risk: { icon: Shield, color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Risk' },
  Complaint: { icon: MessageSquareWarning, color: 'bg-pink-100 text-pink-700 border-pink-200', label: 'Complaint' },
  ChangeRequest: { icon: ArrowRight, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Change' },
};

export default function TraceabilityChain({ items, currentId }: TraceabilityChainProps) {
  const navigate = useNavigate();

  if (items.length === 0) return (
    <div className="text-center py-6 text-gray-400 text-sm">No linked records</div>
  );

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const cfg = TYPE_CONFIG[item.type];
        const Icon = cfg.icon;
        const isCurrent = item.id === currentId;
        return (
          <div key={item.id} className="flex items-center gap-2">
            {idx > 0 && (
              <div className="ml-4 mb-2 flex items-center">
                <div className="w-px h-4 bg-gray-200 ml-3.5" />
              </div>
            )}
            <button
              onClick={() => !isCurrent && navigate(item.link)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-175',
                isCurrent
                  ? 'border-blue-500 bg-blue-50 cursor-default'
                  : cn('hover:shadow-card-hover', cfg.color)
              )}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', isCurrent ? 'bg-blue-600 text-white' : 'bg-white/70')}>
                <Icon size={14} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold opacity-70">{item.number}</span>
                  {isCurrent && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">Current</span>}
                </div>
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs opacity-60">{item.status}</p>
              </div>
              {!isCurrent && <ExternalLink size={13} className="shrink-0 opacity-40" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
