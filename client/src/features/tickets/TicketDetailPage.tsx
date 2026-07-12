import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Spinner, Tabs } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteTicket, useTicket } from '@/lib/api/ticket';
import ActionBar from './detail/ActionBar';
import ApprovalAwaitingCard from './detail/ApprovalAwaitingCard';
import TicketHeaderCard from './detail/TicketHeaderCard';
import StageFormSection from './detail/StageFormSection';
import AuditComplianceCard from './detail/AuditComplianceCard';
import AuditCapaChildrenCard from './detail/AuditCapaChildrenCard';
import TicketFormHistory from './detail/TicketFormHistory';
import { type SelectedStageInfo } from './detail/TicketFlowCanvas';
import StageTabs from './detail/StageTabs';
import TicketActivityModal from './detail/TicketActivityModal';
import TicketDetailsModal from './detail/TicketDetailsModal';
import TicketSidebar from './detail/TicketSidebar';
import TicketDetailsTab from './detail/TicketDetailsTab';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'forms', label: 'Stage Forms' },
  { id: 'history', label: 'History' },
];

export default function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();

  // Diagram open by default — it's the selector that drives the stage form view.
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<SelectedStageInfo | null>(null);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    setSelectedStage(null);
    setWorkflowOpen(true);
    setActivityOpen(false);
    setDetailsOpen(false);
    setTab('details');
  }, [id]);

  const { data: ticket, isLoading, error } = useTicket(id);

  // Per-type gating with the global `ticket.*` master as the OR-bridge fallback.
  // The type comes from the ticket's (root) flow; null → only the global key grants.
  const typeId = ticket?.flows[0]?.workflow.typeId ?? null;
  const canForType = (action: string) =>
    hasPermission(`ticket.${action}`) ||
    (!!typeId && hasPermission(`wf_type.${typeId}.${action}`));
  const canTransition = canForType('transition');
  const canUpdate = canForType('update');
  const canDelete = canForType('delete');

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

        {/* Workflow flow band — stage selector + stage actions. */}
        {flow && workflowOpen && (
          <StageTabs
            workflowId={flow.workflow.id}
            currentStageIds={flow.currentStages.map((s) => s.canonicalId)}
            currentPersistedStageIds={flow.currentStages.map((s) => s.id)}
            isCompleted={isCompleted}
            selectedCanonicalId={selectedStage?.canonicalId ?? null}
            onStageSelect={setSelectedStage}
          />
        )}
        {!isCompleted && (
          <ActionBar
            ticketId={ticket.id}
            isOnHold={ticket.isOnHold}
            isCompleted={isCompleted}
            canTransition={canTransition}
          />
        )}

        {/* Body: tabbed content + persistent metadata sidebar (CAPA-style). */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="min-w-0">
            <div className="mb-3">
              <Tabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
            </div>

            {tab === 'details' && <TicketDetailsTab ticket={ticket} canEdit={canUpdate} />}

            {tab === 'forms' && (
              <div className="space-y-4">
                <StageFormSection ticketId={ticket.id} />
                {typeof ticket.customFields?.audit_register_id === 'string' && (
                  <>
                    <AuditComplianceCard registerId={ticket.customFields.audit_register_id} />
                    <AuditCapaChildrenCard registerId={ticket.customFields.audit_register_id} />
                  </>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-4">
                <TicketFormHistory
                  ticketId={ticket.id}
                  selectedStageId={selectedStage?.persistedId ?? null}
                  currentStageIds={flow?.currentStages.map((s) => s.id) ?? []}
                  isCompleted={isCompleted}
                />
                <ApprovalAwaitingCard ticketId={ticket.id} />
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-4">
            <TicketSidebar ticket={ticket} />
          </div>
        </div>
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

