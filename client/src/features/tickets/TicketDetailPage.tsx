import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, User as UserIcon, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Spinner, Tabs } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteTicket, useTicket } from '@/lib/api/ticket';
import TicketStatusBadge from './shared/TicketStatusBadge';
import ActionBar from './detail/ActionBar';
import TimelineTab from './detail/TimelineTab';
import CommentsTab from './detail/CommentsTab';
import DocsTab from './detail/DocsTab';
import SlaPanel from './detail/SlaPanel';
import ApprovalAwaitingCard from './detail/ApprovalAwaitingCard';
import RequiredFormsCard from './detail/RequiredFormsCard';
import ApprovalsTimeline from './detail/ApprovalsTimeline';

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'comments', label: 'Comments' },
  { id: 'docs', label: 'Documents' },
];

export default function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canTransition = hasPermission('ticket.transition');
  const canUpdate = hasPermission('ticket.update');
  const canDelete = hasPermission('ticket.delete');
  const [activeTab, setActiveTab] = useState('timeline');

  const { data: ticket, isLoading, error } = useTicket(id);
  const remove = useDeleteTicket();

  const handleDelete = async () => {
    if (!ticket) return;
    if (!confirm(`Delete ticket ${ticket.uniqueId}? This is a soft-delete.`)) return;
    try {
      await remove.mutateAsync(ticket.id);
      toast.success('Ticket deleted');
      navigate('/tickets');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </PageContainer>
    );
  }
  if (error || !ticket) {
    return (
      <PageContainer>
        <Card>
          <p className="text-sm text-red-600">Ticket not found.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} className="mt-3">
            <ArrowLeft size={14} />
            <span className="ml-1">Back to tickets</span>
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const flow = ticket.flows[0];
  const isCompleted = !!flow?.isCompleted;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} className="mb-3">
        <ArrowLeft size={14} />
        <span className="ml-1">Tickets</span>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {ticket.uniqueId}
            </span>
            <h1 className="text-h1 text-gray-900 truncate">{ticket.title}</h1>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <TicketStatusBadge ticket={ticket} />
            {ticket.priority && (
              <span className="text-xs text-gray-500">Priority: {ticket.priority.name}</span>
            )}
            {flow && (
              <span className="text-xs text-gray-500">
                {flow.workflow.name} v{flow.workflow.version}
              </span>
            )}
          </div>
        </div>
        {canDelete && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={handleDelete}
              isLoading={remove.isPending}
              disabled={remove.isPending}
            >
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3 min-w-0">
          <Card>
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Description
            </h3>
            {ticket.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">No description.</p>
            )}
          </Card>

          {flow && flow.currentStages.length > 0 && !isCompleted && (
            <Card>
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Current stage{flow.currentStages.length > 1 ? 's' : ''}
              </h3>
              <div className="flex flex-wrap gap-2">
                {flow.currentStages.map((s) => (
                  <span
                    key={s.id}
                    className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-md"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <ApprovalAwaitingCard ticketId={ticket.id} />

          <RequiredFormsCard ticketId={ticket.id} />

          <ActionBar
            ticketId={ticket.id}
            isOnHold={ticket.isOnHold}
            isCompleted={isCompleted}
            canTransition={canTransition}
          />

          {ticket.isOnHold && ticket.holdReason && (
            <Card className="!p-3 border border-amber-200 bg-amber-50">
              <p className="text-xs font-semibold text-amber-900 mb-1">On Hold</p>
              <p className="text-sm text-amber-800">{ticket.holdReason}</p>
              {ticket.heldBy && (
                <p className="text-xs text-amber-700 mt-1">
                  by {ticket.heldBy.name}
                  {ticket.heldAt && ` · ${formatDate(ticket.heldAt)}`}
                </p>
              )}
            </Card>
          )}

          <div>
            <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="mt-3">
              {activeTab === 'timeline' && <TimelineTab ticketId={ticket.id} />}
              {activeTab === 'approvals' && <ApprovalsTimeline ticketId={ticket.id} />}
              {activeTab === 'comments' && <CommentsTab ticketId={ticket.id} />}
              {activeTab === 'docs' && <DocsTab ticketId={ticket.id} canUpdate={canUpdate} />}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SlaPanel ticketId={ticket.id} />

          <Card>
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              {ticket.createdBy && (
                <div className="flex items-center gap-2 text-gray-700">
                  <UserIcon size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Created by</span>
                  <span className="ml-auto truncate">{ticket.createdBy.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">Created</span>
                <span className="ml-auto">{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.department && (
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-xs text-gray-500">Department</span>
                  <span className="ml-auto truncate">{ticket.department.name}</span>
                </div>
              )}
              {ticket.parentTicket && (
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-xs text-gray-500">Parent</span>
                  <button
                    onClick={() => navigate(`/tickets/${ticket.parentTicket!.id}`)}
                    className="ml-auto text-blue-600 hover:underline truncate"
                  >
                    {ticket.parentTicket.uniqueId}
                  </button>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
