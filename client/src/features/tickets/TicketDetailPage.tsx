import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Spinner, Tabs } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteTicket, useTicket, useTicketTrack } from '@/lib/api/ticket';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import { findingTypeReadKey, findingTypeCreateKey } from '@/lib/navAccess';
import FindingsTab from './detail/FindingsTab';
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
  const { data: trackRows } = useTicketTrack(id);

  // Which stages the ticket actually entered, and — when it was rejected —
  // which it was parked on at the time. A rejected flow is also `isCompleted`,
  // so without this the stage band paints every stage in the workflow green,
  // including branches the ticket never reached.
  const { visitedStageIds, rejectedAtStageIds } = useMemo(() => {
    const rows = trackRows ?? [];
    const visited = [...new Set(rows.map((r) => r.stageId).filter((s): s is string => !!s))];
    if (!ticket?.flows[0]?.isRejected) {
      return { visitedStageIds: visited, rejectedAtStageIds: [] as string[] };
    }
    // A stage left by moving on has a successor entered at (or after) its exit;
    // the stage(s) the ticket stopped on have nothing entered after them. That
    // holds for parallel branches and for approval-driven rejection, where no
    // REJECT-behaviour action is recorded — unlike a timestamp window, which
    // can't tell a forward 70ms before the rejection from the rejection itself.
    // `openStageTracking` runs after `closeStageTracking` inside the same
    // transaction, so a successor's enteredAt is always >= the exit it followed.
    const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
    const hasSuccessor = (row: (typeof rows)[number]) => {
      const exited = ms(row.exitedAt);
      if (Number.isNaN(exited)) return true; // still active — not a stop point
      return rows.some(
        (o) => o.id !== row.id && !Number.isNaN(ms(o.enteredAt)) && ms(o.enteredAt) >= exited,
      );
    };
    const stoppedAt = [
      ...new Set(
        rows
          .filter((r) => r.exitedAt && !hasSuccessor(r))
          .map((r) => r.stageId)
          .filter((s): s is string => !!s),
      ),
    ];
    return { visitedStageIds: visited, rejectedAtStageIds: stoppedAt };
  }, [trackRows, ticket]);

  // Per-type gating with the global `ticket.*` master as the OR-bridge fallback.
  // The type comes from the ticket's (root) flow; null → only the global key grants.
  const typeId = ticket?.flows[0]?.workflow.typeId ?? null;
  const canForType = (action: string) =>
    hasPermission(`ticket.${action}`) ||
    (!!typeId && hasPermission(`wf_type.${typeId}.${action}`));
  const canTransition = canForType('transition');
  const canUpdate = canForType('update');
  const canDelete = canForType('delete');

  // Findings capability is per WorkflowType (flag on the type) AND per-type
  // RBAC: the tab shows only when the type supports findings and the user holds
  // this type's `finding.<id>.read` key; the Add/Raise buttons need `.create`.
  const { data: wfTypes } = useWorkflowTypes();
  const supportsFindings =
    wfTypes?.find((t) => t.id === typeId)?.supportsFindings ?? false;
  const canReadFindings = !!typeId && hasPermission(findingTypeReadKey(typeId));
  const canManageFindings = !!typeId && hasPermission(findingTypeCreateKey(typeId));
  const showFindings = supportsFindings && canReadFindings;
  const tabs = useMemo(
    () => [...TABS, ...(showFindings ? [{ id: 'findings', label: 'Findings' }] : [])],
    [showFindings],
  );

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
  const isRejected = !!flow?.isRejected;

  // Stage clicked in the workflow band. When it's a stage the ticket has already
  // moved past, the Stage Forms tab shows that stage's submitted (read-only)
  // forms instead of the current stage's fillable form.
  const currentCanonicalIds = flow?.currentStages.map((s) => s.canonicalId) ?? [];
  const currentPersistedIds = flow?.currentStages.map((s) => s.id) ?? [];
  const viewingPastStage =
    !!selectedStage && !currentCanonicalIds.includes(selectedStage.canonicalId);

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
            isRejected={isRejected}
            visitedPersistedStageIds={visitedStageIds}
            rejectedAtPersistedStageIds={rejectedAtStageIds}
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
            selectedStageCanonicalId={selectedStage?.canonicalId ?? null}
          />
        )}

        {/* Body: tabbed content + persistent metadata sidebar (CAPA-style). */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="min-w-0">
            <div className="mb-3">
              <Tabs tabs={tabs} activeTab={tab} onTabChange={setTab} />
            </div>

            {tab === 'details' && <TicketDetailsTab ticket={ticket} canEdit={canUpdate} />}

            {tab === 'findings' && (
              <FindingsTab ticketId={ticket.id} canCreate={canManageFindings} />
            )}

            {tab === 'forms' && (
              <div className="space-y-4">
                {viewingPastStage ? (
                  // A completed/earlier stage is selected in the band → show that
                  // stage's submitted forms (read-only) rather than the current one.
                  <TicketFormHistory
                    ticketId={ticket.id}
                    selectedStageId={selectedStage?.persistedId ?? null}
                    currentStageIds={currentPersistedIds}
                    isCompleted={isCompleted}
                  />
                ) : (
                  <>
                    <StageFormSection ticketId={ticket.id} />
                    {typeof ticket.customFields?.audit_register_id === 'string' && (
                      <>
                        <AuditComplianceCard registerId={ticket.customFields.audit_register_id} />
                        <AuditCapaChildrenCard registerId={ticket.customFields.audit_register_id} />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-4">
                <TicketFormHistory
                  ticketId={ticket.id}
                  selectedStageId={selectedStage?.persistedId ?? null}
                  currentStageIds={currentPersistedIds}
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

