import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User as UserIcon,
  Calendar,
  Workflow as WorkflowIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  CircleDot,
  PauseCircle,
  Trash2,
} from 'lucide-react';
import { Button, Card, Spinner, Tabs } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { formatDate, formatDateTime, displayWorkflowName } from '@/lib/utils';
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
import SubmittedFormsCard from './detail/SubmittedFormsCard';
import ApprovalsTimeline from './detail/ApprovalsTimeline';
import TicketFlowCanvas from './detail/TicketFlowCanvas';

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
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();
  const [activeTab, setActiveTab] = useState('timeline');
  const [flowOpen, setFlowOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ticketDetail.flowOpen') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ticketDetail.flowOpen', flowOpen ? 'true' : 'false');
  }, [flowOpen]);

  const { data: ticket, isLoading, error } = useTicket(id);

  const handleDelete = () => {
    if (!ticket) return;
    modal.confirm({
      title: 'Delete ticket',
      content: `Are you sure you want to delete ${ticket.uniqueId}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteTicket.mutateAsync(ticket.id);
          toast.success('Ticket deleted');
          navigate('/tickets');
        } catch (err) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
              ?.error?.message ?? 'Failed to delete';
          toast.error(msg);
        }
      },
    });
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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {ticket.uniqueId}
            </span>
            <h1 className="text-h1 text-gray-900 truncate">{ticket.title}</h1>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <TicketStatusBadge ticket={ticket} />
            {ticket.priority && (
              <span className="text-xs text-gray-500">Priority: {ticket.priority.name}</span>
            )}
            {flow && (
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                <WorkflowIcon size={11} className="text-gray-400" />
                {displayWorkflowName(flow.workflow)} <span className="text-gray-300">·</span> v
                {flow.workflow.version}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {flow && (
            <Button
              variant={flowOpen ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setFlowOpen((v) => !v)}
            >
              {flowOpen ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="ml-1.5">{flowOpen ? 'Hide stages' : 'View stages'}</span>
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              isLoading={deleteTicket.isPending}
              disabled={deleteTicket.isPending}
              title="Delete ticket"
            >
              <Trash2 size={14} className="text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {flow && (
        <Card noPadding className="mt-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setFlowOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 hover:bg-gray-100/60 transition-colors text-left"
            aria-expanded={flowOpen}
          >
            <div className="flex items-center gap-2">
              {flowOpen ? (
                <ChevronDown size={14} className="text-gray-500" />
              ) : (
                <ChevronRight size={14} className="text-gray-500" />
              )}
              <WorkflowIcon size={14} className="text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Workflow progress
              </h3>
              <span className="text-[11px] text-gray-400">
                {displayWorkflowName(flow.workflow)} · v{flow.workflow.version}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isCompleted && flow.currentStages.length > 0 && (
                <span className="text-[11px] text-gray-500">
                  {flow.currentStages.length === 1
                    ? '1 stage active'
                    : `${flow.currentStages.length} stages active`}
                </span>
              )}
              {isCompleted && (
                <span className="text-[11px] text-emerald-600 font-medium">
                  Flow completed
                </span>
              )}
              {flowOpen && (
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#C9A84C]" />
                  current stage
                </span>
              )}
              <span className="ml-2 text-[11px] text-[#8A6C18] font-medium">
                {flowOpen ? 'Hide' : 'Show'}
              </span>
            </div>
          </button>
          {flowOpen && (
            <TicketFlowCanvas
              workflowId={flow.workflow.id}
              currentStageIds={flow.currentStages.map((s) => s.canonicalId)}
              currentPersistedStageIds={flow.currentStages.map((s) => s.id)}
              direction="LR"
              height={280}
            />
          )}
        </Card>
      )}

      {flow && (
        <StageStatusBanner
          isCompleted={isCompleted}
          isOnHold={ticket.isOnHold}
          completedAt={flow.completedAt}
          currentStages={flow.currentStages}
          onShowFlow={() => setFlowOpen(true)}
          flowOpen={flowOpen}
        />
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* ── Left: ticket content ─────────────────────────────────────── */}
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

          <ApprovalAwaitingCard ticketId={ticket.id} />

          <RequiredFormsCard ticketId={ticket.id} />

          <SubmittedFormsCard ticketId={ticket.id} />

          {!isCompleted && (
            <ActionBar
              ticketId={ticket.id}
              isOnHold={ticket.isOnHold}
              isCompleted={isCompleted}
              canTransition={canTransition}
            />
          )}
        </div>

        {/* ── Right: activity tabs + SLA ───────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          <SlaPanel ticketId={ticket.id} />

          <Card noPadding className="overflow-hidden">
            <div className="px-4 pt-3">
              <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
            <div className="px-4 pb-4 pt-3 max-h-[640px] overflow-y-auto">
              {activeTab === 'timeline' && <TimelineTab ticketId={ticket.id} />}
              {activeTab === 'approvals' && <ApprovalsTimeline ticketId={ticket.id} />}
              {activeTab === 'comments' && <CommentsTab ticketId={ticket.id} />}
              {activeTab === 'docs' && <DocsTab ticketId={ticket.id} canUpdate={canUpdate} />}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Details footer (full width, below everything) ──────────────── */}
      <Card className="mt-4">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Details
        </h3>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {ticket.createdBy && (
            <div className="flex items-center gap-2 min-w-0">
              <UserIcon size={12} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-gray-500">Created by</div>
                <div className="truncate text-gray-800">{ticket.createdBy.name}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={12} className="text-gray-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-gray-500">Created</div>
              <div className="truncate text-gray-800">{formatDate(ticket.createdAt)}</div>
            </div>
          </div>
          {ticket.department && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-gray-500">Department</div>
                <div className="truncate text-gray-800">{ticket.department.name}</div>
              </div>
            </div>
          )}
          {ticket.parentTicket && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-gray-500">Parent ticket</div>
                <button
                  onClick={() => navigate(`/tickets/${ticket.parentTicket!.id}`)}
                  className="text-blue-600 hover:underline truncate text-left"
                >
                  {ticket.parentTicket.uniqueId}
                </button>
              </div>
            </div>
          )}
        </dl>
      </Card>
    </PageContainer>
  );
}

interface StageStatusBannerProps {
  isCompleted: boolean;
  isOnHold: boolean;
  completedAt: string | null;
  currentStages: Array<{ id: string; name: string }>;
  onShowFlow: () => void;
  flowOpen: boolean;
}

function StageStatusBanner({
  isCompleted,
  isOnHold,
  completedAt,
  currentStages,
  onShowFlow,
  flowOpen,
}: StageStatusBannerProps) {
  if (isCompleted) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle2 size={18} className="text-emerald-600" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-emerald-900">Ticket completed</div>
          <div className="text-xs text-emerald-700">
            {completedAt
              ? `Closed on ${formatDateTime(completedAt)}`
              : 'No further actions required.'}
          </div>
        </div>
      </div>
    );
  }

  if (isOnHold) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <PauseCircle size={18} className="text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900">On hold</div>
          <div className="text-xs text-amber-700">
            Resume from the action bar below to continue progressing the workflow.
          </div>
        </div>
      </div>
    );
  }

  if (currentStages.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-[#C9A84C]/15 flex items-center justify-center shrink-0">
        <CircleDot size={18} className="text-[#8A6C18]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A6C18]">
          Current stage{currentStages.length > 1 ? 's' : ''}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {currentStages.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5C4A0F] bg-white border border-[#C9A84C]/40 px-2.5 py-0.5 rounded-full"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      {!flowOpen && (
        <button
          type="button"
          onClick={onShowFlow}
          className="text-xs font-medium text-[#8A6C18] hover:text-[#5C4A0F] underline-offset-2 hover:underline shrink-0"
        >
          View flow →
        </button>
      )}
    </div>
  );
}
