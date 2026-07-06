import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Edit3, MousePointerClick, Pause, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useSetWorkflowStatus,
  useSoftDeleteWorkflow,
  useWorkflow,
  workflowKeys,
} from '@/lib/api/workflow';
import { useActionCriteria } from '@/lib/api/workflowLookups';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import WorkflowStatusBadge from './shared/WorkflowStatusBadge';
import WorkflowStageDetails from './WorkflowStageDetails';
import { deserializeFlow } from './builder/builder.serializer';
import { layoutGraph } from './builder/layout';
import JsPlumbCanvas from './builder/JsPlumbCanvas';

export default function WorkflowDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canUpdate = hasPermission('workflow.update');
  const canDelete = hasPermission('workflow.delete');

  const { data, isLoading, error } = useWorkflow(id);
  const softDelete = useSoftDeleteWorkflow();
  const setStatus = useSetWorkflowStatus(id);
  const confirmDelete = useConfirmDelete();
  const { data: criteria } = useActionCriteria();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const criteriaName = useMemo(() => {
    const map = new Map((criteria ?? []).map((c) => [c.id, c.name]));
    return (cid?: string | null) => (cid ? map.get(cid) : undefined);
  }, [criteria]);

  const flowJson = useMemo(() => data?.flow_json ?? { nodes: [], edges: [] }, [data]);

  // Apply dagre layout to the deserialised graph — backend no longer stores
  // positions, so every node arrives at (0,0) and needs computed coordinates.
  const { nodes, edges } = useMemo(() => {
    const { nodes: n, edges: e } = deserializeFlow(flowJson.nodes, flowJson.edges);
    return { nodes: layoutGraph(n, e, { direction: 'TB' }), edges: e };
  }, [flowJson]);

  const handleDelete = () => {
    if (!data) return;
    confirmDelete({
      entityLabel: 'workflow',
      name: displayWorkflowName(data.workflow),
      extraWarning: 'This is a soft-delete and can be undone by an admin.',
      mutate: async () => {
        await softDelete.mutateAsync(data.workflow.id);
        navigate('/workflows');
      },
      invalidateKey: workflowKeys.all,
      successMessage: 'Workflow deleted',
    });
  };

  const handleSetStatus = async (next: 'ACTIVE' | 'INACTIVE' | 'DRAFT') => {
    try {
      await setStatus.mutateAsync(next);
      toast.success(
        next === 'ACTIVE'
          ? 'Workflow activated'
          : next === 'INACTIVE'
            ? 'Workflow deactivated'
            : 'Workflow returned to draft',
      );
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to change status';
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
  if (error || !data) {
    return (
      <PageContainer>
        <Card>
          <p className="text-sm text-red-600">Workflow not found.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="mt-3">
            <ArrowLeft size={14} />
            <span className="ml-1">Back to workflows</span>
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const wf = data.workflow;
  // Canvas nodes drive both the selectable list and the detail panel so ids
  // line up with jsPlumb selection.
  const stageNodes = nodes.filter((n) => n.type === 'stage');
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const nodeLabel = (nid: string) =>
    (nodes.find((n) => n.id === nid)?.data as { label?: string } | undefined)?.label ?? '—';
  const outgoing = selectedNode
    ? edges.filter((e) => e.source === selectedNode.id).map((e) => nodeLabel(e.target))
    : [];
  const incoming = selectedNode
    ? edges.filter((e) => e.target === selectedNode.id).map((e) => nodeLabel(e.source))
    : [];

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')}>
        <ArrowLeft size={14} />
        <span className="ml-1">Workflows</span>
      </Button>

      <PageHeader
        title={displayWorkflowName(wf)}
        description={
          <span className="flex items-center gap-2 mt-0.5">
            <WorkflowStatusBadge status={wf.workflowStatus} />
            {wf.type && <span className="text-xs text-gray-500">{wf.type.name}</span>}
            <span className="text-xs text-gray-400">· updated {formatDate(wf.updatedAt)}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            {canUpdate && wf.workflowStatus !== 'ACTIVE' && (
              <Button
                variant="primary"
                onClick={() => handleSetStatus('ACTIVE')}
                isLoading={setStatus.isPending}
                disabled={setStatus.isPending}
                title={
                  nodes.length === 0
                    ? 'Add at least one stage in the builder before activating'
                    : undefined
                }
              >
                <CheckCircle2 size={16} />
                <span className="ml-1.5">Activate</span>
              </Button>
            )}
            {canUpdate && wf.workflowStatus === 'ACTIVE' && (
              <Button
                variant="outline"
                onClick={() => handleSetStatus('INACTIVE')}
                isLoading={setStatus.isPending}
                disabled={setStatus.isPending}
              >
                <Pause size={16} />
                <span className="ml-1.5">Deactivate</span>
              </Button>
            )}
            {canUpdate && (
              <Button
                variant={wf.workflowStatus === 'ACTIVE' ? 'outline' : 'primary'}
                onClick={() => navigate(`/workflows/${wf.id}/builder`)}
              >
                <Edit3 size={16} />
                <span className="ml-1.5">Edit in builder</span>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                isLoading={softDelete.isPending}
                disabled={softDelete.isPending}
              >
                <Trash2 size={16} className="text-red-500" />
              </Button>
            )}
          </div>
        }
      />

      {nodes.length === 0 ? (
        <Card>
          <EmptyState
            icon={WorkflowIcon}
            title="Workflow has no stages yet"
            description="Open the builder to design your workflow graph."
            actionLabel={canUpdate ? 'Open builder' : undefined}
            onAction={canUpdate ? () => navigate(`/workflows/${wf.id}/builder`) : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <Card noPadding className="overflow-hidden" style={{ height: 600 }}>
            <JsPlumbCanvas
              nodes={nodes}
              edges={edges}
              interactive
              editable={false}
              direction="TB"
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPaneClick={() => setSelectedId(null)}
            />
          </Card>

          <div className="space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
            {/* Stage navigator */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Stages</h3>
              {stageNodes.length === 0 ? (
                <p className="text-xs text-gray-500">No stages.</p>
              ) : (
                <ul className="space-y-1">
                  {stageNodes.map((n) => {
                    const d = n.data as { label: string; is_initial_stage?: boolean };
                    const active = n.id === selectedId;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(active ? null : n.id)}
                          className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                            active
                              ? 'bg-gold-50 ring-1 ring-gold-300'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {d.label || 'Untitled'}
                          </span>
                          {d.is_initial_stage && (
                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">
                              initial
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Selected stage details */}
            <Card>
              {selectedNode ? (
                <WorkflowStageDetails
                  node={selectedNode}
                  criteriaName={criteriaName}
                  incoming={incoming}
                  outgoing={outgoing}
                />
              ) : (
                <div className="flex flex-col items-center text-center py-6 px-2">
                  <MousePointerClick size={22} className="text-gray-300 mb-2" />
                  <p className="text-xs text-gray-500">
                    Select a stage to see its actions, attached forms, SLA and approval policies.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
