import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteTicket, useTicket } from '@/lib/api/ticket';
import ActionBar from './detail/ActionBar';
import ApprovalAwaitingCard from './detail/ApprovalAwaitingCard';
import TicketHeaderCard from './detail/TicketHeaderCard';
import StageFormSection from './detail/StageFormSection';
import TicketFlowCanvas, { type SelectedStageInfo } from './detail/TicketFlowCanvas';
import TicketActivityModal from './detail/TicketActivityModal';
import TicketDetailsModal from './detail/TicketDetailsModal';

export default function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canTransition = hasPermission('ticket.transition');
  const canUpdate = hasPermission('ticket.update');
  const canDelete = hasPermission('ticket.delete');
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();

  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<SelectedStageInfo | null>(null);

  useEffect(() => {
    setSelectedStage(null);
    setActivityOpen(false);
    setDetailsOpen(false);
  }, [id]);

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
          navigate(-1);
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
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-3">
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
      <div className="space-y-4">
        <TicketHeaderCard
          ticket={ticket}
          onOpenWorkflow={() => setWorkflowOpen((v) => !v)}
          onOpenActivity={() => setActivityOpen(true)}
          onOpenDetails={() => setDetailsOpen(true)}
          onBack={() => navigate(-1)}
          onDelete={handleDelete}
          canDelete={canDelete}
          isDeleting={deleteTicket.isPending}
        />

        {flow && workflowOpen && (
          <Card noPadding className="overflow-hidden">
            <TicketFlowCanvas
              workflowId={flow.workflow.id}
              currentStageIds={flow.currentStages.map((s) => s.canonicalId)}
              currentPersistedStageIds={flow.currentStages.map((s) => s.id)}
              direction="LR"
              height={240}
              onStageNodeClick={setSelectedStage}
              onPaneClick={() => setSelectedStage(null)}
            />
            {selectedStage && !selectedStage.isCurrent && (
              <div className="px-4 py-2 border-t border-gray-100 bg-slate-50 text-xs flex items-center gap-2">
                <span className="text-slate-500 uppercase font-semibold tracking-wide text-[10px]">
                  {selectedStage.isInitial ? 'Initial stage' : 'Selected stage'}
                </span>
                <span className="font-medium text-slate-800">{selectedStage.name}</span>
                <button
                  type="button"
                  className="ml-auto text-slate-500 hover:text-slate-700"
                  onClick={() => setSelectedStage(null)}
                >
                  Clear
                </button>
              </div>
            )}
          </Card>
        )}

        <StageFormSection ticketId={ticket.id} />

        <ApprovalAwaitingCard ticketId={ticket.id} />

        {!isCompleted && (
          <ActionBar
            ticketId={ticket.id}
            isOnHold={ticket.isOnHold}
            isCompleted={isCompleted}
            canTransition={canTransition}
          />
        )}
      </div>

      <TicketActivityModal
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
        ticketId={ticket.id}
        canUpdate={canUpdate}
      />
      <TicketDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        ticket={ticket}
      />
    </PageContainer>
  );
}

