import { Check, X, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalStage {
  name: string;
  status: 'completed' | 'active' | 'pending' | 'rejected';
  approver?: string;
  timestamp?: string;
  comment?: string;
}

interface ApprovalTimelineProps {
  stages: ApprovalStage[];
}

const statusConfig = {
  completed: {
    dot: 'bg-emerald-500',
    icon: Check,
    text: 'text-emerald-700',
    line: 'bg-emerald-300',
  },
  active: {
    dot: 'bg-blue-500 animate-pulse-soft',
    icon: Clock,
    text: 'text-blue-700',
    line: 'bg-gray-200',
  },
  pending: {
    dot: 'bg-gray-200',
    icon: Circle,
    text: 'text-gray-400',
    line: 'bg-gray-200',
  },
  rejected: {
    dot: 'bg-red-500',
    icon: X,
    text: 'text-red-700',
    line: 'bg-red-200',
  },
};

export default function ApprovalTimeline({ stages }: ApprovalTimelineProps) {
  return (
    <div className="relative pl-8 space-y-0">
      {stages.map((stage, i) => {
        const config = statusConfig[stage.status];
        const IconComponent = config.icon;
        const isLast = i === stages.length - 1;

        return (
          <div key={i} className="relative pb-6 last:pb-0">
            {/* Connecting line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[-21px] top-[18px] w-[2px] h-[calc(100%-2px)]',
                  config.line,
                )}
              />
            )}

            {/* Dot */}
            <div
              className={cn(
                'absolute left-[-27px] top-[3px] w-[14px] h-[14px] rounded-full flex items-center justify-center',
                config.dot,
              )}
            >
              {stage.status !== 'pending' && (
                <IconComponent size={8} className="text-white" strokeWidth={3} />
              )}
            </div>

            {/* Content */}
            <div className="animate-fade-in">
              <p className={cn('text-sm font-medium', config.text)}>
                {stage.name}
              </p>
              {stage.approver && (
                <p className="text-xs text-gray-500 mt-0.5">{stage.approver}</p>
              )}
              {stage.timestamp && (
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{stage.timestamp}</p>
              )}
              {stage.comment && (
                <p className="text-xs text-gray-500 mt-1.5 italic bg-gray-50 rounded-md px-2.5 py-1.5">
                  "{stage.comment}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
