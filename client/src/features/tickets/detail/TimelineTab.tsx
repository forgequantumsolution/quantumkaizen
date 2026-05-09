import { ArrowRight, ArrowLeftCircle, MessageCircle } from 'lucide-react';
import { Card, Spinner } from '@/components/ui';
import { useTicketTimeline } from '@/lib/api/ticket';
import { formatDate } from '@/lib/utils';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${formatDate(iso)} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function TimelineTab({ ticketId }: { ticketId: string }) {
  const { data: entries = [], isLoading, error } = useTicketTimeline(ticketId);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <Card><p className="text-sm text-red-600">Failed to load timeline.</p></Card>;
  if (entries.length === 0) return <Card><p className="text-xs text-gray-500 text-center py-8">No timeline entries yet.</p></Card>;

  return (
    <Card className="!p-4">
      <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
        {entries.map((e, i) => {
          const Icon =
            e.kind === 'stage_entered'
              ? ArrowRight
              : e.kind === 'stage_exited'
                ? ArrowLeftCircle
                : MessageCircle;
          const color =
            e.kind === 'stage_entered'
              ? 'bg-blue-100 text-blue-600'
              : e.kind === 'stage_exited'
                ? 'bg-green-100 text-green-600'
                : 'bg-purple-100 text-purple-600';
          return (
            <li key={i} className="ml-4">
              <span
                className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ${color} ring-4 ring-white`}
              >
                <Icon size={12} />
              </span>
              <div className="text-sm">
                {e.kind === 'stage_entered' && (
                  <p>
                    Entered <span className="font-semibold">{e.stageName}</span>
                    {e.performedBy && (
                      <span className="text-gray-500"> · by {e.performedBy.name}</span>
                    )}
                  </p>
                )}
                {e.kind === 'stage_exited' && (
                  <p>
                    Exited <span className="font-semibold">{e.stageName}</span>
                    {e.actionName && (
                      <span className="text-gray-500"> via {e.actionName}</span>
                    )}
                    {e.performedBy && (
                      <span className="text-gray-500"> · by {e.performedBy.name}</span>
                    )}
                  </p>
                )}
                {e.kind === 'comment' && (
                  <p>
                    <span className="font-semibold">{e.author?.name ?? 'Someone'}</span>{' '}
                    commented:{' '}
                    <span className="text-gray-700 italic">"{e.body}"</span>
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(e.at)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
