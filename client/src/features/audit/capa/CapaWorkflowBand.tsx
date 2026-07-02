import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { CircleDot, Workflow as WorkflowIcon, CheckCircle2 } from 'lucide-react';
import { Card, Button, Badge, Modal, Spinner } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import { useTicket } from '@/lib/api/ticket';
import { useAttachCapaWorkflow, useUpdateCapaStatus, auditKeys, type Capa } from '@/lib/api/audit';
import ActionBar from '@/features/tickets/detail/ActionBar';
import TicketFlowCanvas from '@/features/tickets/detail/TicketFlowCanvas';
import CapaEnumStepper, { CAPA_ENUM_FLOW } from './CapaEnumStepper';

const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Something went wrong';

// The hybrid flow band: a compact current-stage strip inline, the full workflow
// DAG in a "View workflow" modal, and the stage transition actions. When a CAPA
// has no workflow ticket yet, offers to raise one.
export default function CapaWorkflowBand({ capa }: { capa: Capa }) {
  const ticketId = capa.workflow_ticket_id ?? undefined;
  const { data: ticket, isLoading } = useTicket(ticketId);
  const [flowOpen, setFlowOpen] = useState(false);
  const attachMut = useAttachCapaWorkflow();
  const statusMut = useUpdateCapaStatus();
  const canTransition = useHasPermission('ticket.transition');
  const canUpdate = useHasPermission('capa.update');
  const qc = useQueryClient();

  // The ticket transition hooks only invalidate ticket-side queries. But a
  // transition also moves the CAPA's derived status/key-dates server-side
  // (getCapa reconciles them). Refetch the CAPA whenever the linked ticket's
  // flow position (or completion) changes, so the header/badge/sidebar don't
  // lag behind the stage the forms are now on.
  const flow0 = ticket?.flows?.[0];
  const flowSig = flow0
    ? `${flow0.isCompleted}|${flow0.currentStages.map((s) => s.id).sort().join(',')}`
    : '';
  useEffect(() => {
    if (flowSig) qc.invalidateQueries({ queryKey: auditKeys.capa(capa.id) });
  }, [flowSig, capa.id, qc]);

  const attach = async () => {
    try {
      await attachMut.mutateAsync(capa.id);
      message.success('CAPA attached to workflow');
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  // No workflow ticket yet → legacy enum lifecycle. Keeps the old manual advance
  // controls, and offers opt-in migration (OPEN-only, so the stage→status sync
  // can't reset a mid-lifecycle CAPA back to the initial stage).
  if (!ticketId) {
    const isClosed = capa.status === 'CLOSED' || capa.status === 'CANCELLED';
    const idx = CAPA_ENUM_FLOW.findIndex((s) => s.status === capa.status);
    const next = idx >= 0 && idx < CAPA_ENUM_FLOW.length - 1 ? CAPA_ENUM_FLOW[idx + 1] : null;
    return (
      <Card>
        <CapaEnumStepper status={capa.status} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <WorkflowIcon size={13} className="text-gray-400" />
            Legacy CAPA — not running on a workflow.
          </span>
          <div className="flex items-center gap-2">
            {canUpdate && next && !isClosed && (
              <Button
                variant="outline"
                size="sm"
                isLoading={statusMut.isPending}
                onClick={() =>
                  statusMut.mutate(
                    { id: capa.id, status: next.status },
                    {
                      onSuccess: () => message.success(`Moved to ${next.label}`),
                      onError: (e) => message.error(errMsg(e)),
                    },
                  )
                }
              >
                Advance → {next.label}
              </Button>
            )}
            {canUpdate && capa.status === 'OPEN' && (
              <Button size="sm" isLoading={attachMut.isPending} onClick={attach}>
                Run on workflow
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading || !ticket) {
    return (
      <Card>
        <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
          <Spinner size="sm" /> Loading workflow…
        </div>
      </Card>
    );
  }

  const flow = ticket.flows[0];
  const isCompleted = !!flow?.isCompleted;
  const currentStages = flow?.currentStages ?? [];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} /> Completed
            </span>
          ) : currentStages.length > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
              <CircleDot size={14} className="text-[#8A6C18]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A6C18]">
                Current
              </span>
              {currentStages.map((s) => (
                <Badge key={s.id} variant="warning">
                  {s.name}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-sm text-gray-500">No active stage</span>
          )}

          {flow && (
            <button
              type="button"
              onClick={() => setFlowOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#8A6C18] transition-colors hover:bg-[#C9A84C]/10"
            >
              <WorkflowIcon size={13} /> View workflow
            </button>
          )}
        </div>
      </Card>

      {!isCompleted && (
        <ActionBar
          ticketId={ticket.id}
          isOnHold={ticket.isOnHold}
          isCompleted={isCompleted}
          canTransition={canTransition}
        />
      )}

      {flow && (
        <Modal isOpen={flowOpen} onClose={() => setFlowOpen(false)} title="Workflow" size="xl">
          <TicketFlowCanvas
            workflowId={flow.workflow.id}
            currentStageIds={currentStages.map((s) => s.canonicalId)}
            currentPersistedStageIds={currentStages.map((s) => s.id)}
            isCompleted={isCompleted}
            direction="LR"
            height={420}
          />
        </Modal>
      )}
    </>
  );
}
