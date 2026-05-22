import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Edit3, Pause, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import { formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useSetWorkflowStatus,
  useSoftDeleteWorkflow,
  useWorkflow,
} from '@/lib/api/workflow';
import WorkflowStatusBadge from './shared/WorkflowStatusBadge';
import { deserializeFlow } from './builder/builder.serializer';
import { layoutGraph } from './builder/layout';
import { nodeTypes } from './builder/nodes';

export default function WorkflowDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canUpdate = hasPermission('workflow.update');
  const canDelete = hasPermission('workflow.delete');

  const { data, isLoading, error } = useWorkflow(id);
  const softDelete = useSoftDeleteWorkflow();
  const setStatus = useSetWorkflowStatus(id);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const needsFitView = useRef(false);

  const flowJson = useMemo(() => data?.flow_json ?? { nodes: [], edges: [] }, [data]);

  // Apply dagre layout to the deserialised graph — backend no longer stores
  // positions, so every node arrives at (0,0) and needs computed coordinates.
  useEffect(() => {
    const { nodes: n, edges: e } = deserializeFlow(flowJson.nodes, flowJson.edges);
    const laidOut = layoutGraph(n, e, { direction: 'TB' });
    setNodes(laidOut);
    setEdges(e);
    needsFitView.current = true;
  }, [flowJson, setNodes, setEdges]);

  // Re-fit the viewport once after the laid-out nodes commit.
  useEffect(() => {
    if (!needsFitView.current || nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      rfInstance.current?.fitView({ padding: 0.18, maxZoom: 1, minZoom: 0.4 });
      needsFitView.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [nodes]);

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm(`Delete "${displayWorkflowName(data.workflow)}"? This is a soft-delete.`)) return;
    try {
      await softDelete.mutateAsync(data.workflow.id);
      toast.success('Workflow deleted');
      navigate('/workflows');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
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
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <p className="text-sm text-red-600">Workflow not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="mt-3">
          <ArrowLeft size={14} />
          <span className="ml-1">Back to workflows</span>
        </Button>
      </Card>
    );
  }

  const wf = data.workflow;
  const allActions = flowJson.nodes
    .filter((n) => (n.data.nodeType ?? n.type ?? 'stage') === 'stage')
    .map((n) => ({
      stageName: n.data.label,
      isInitial: n.data.basic_details?.is_initial_stage === true,
      primary: n.data.primary_actions ?? [],
      secondary: n.data.secondary_actions ?? [],
    }));

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="mb-3">
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
        <Card className="mt-6">
          <EmptyState
            icon={WorkflowIcon}
            title="Workflow has no stages yet"
            description="Open the builder to design your workflow graph."
            actionLabel={canUpdate ? 'Open builder' : undefined}
            onAction={canUpdate ? () => navigate(`/workflows/${wf.id}/builder`) : undefined}
          />
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <Card noPadding className="overflow-hidden" style={{ height: 600 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onInit={(inst) => {
                rfInstance.current = inst;
              }}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                type: 'smoothstep',
                style: { stroke: '#94A3B8', strokeWidth: 2 },
              }}
            >
              <Background gap={16} size={1} color="#E8ECF2" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </Card>

          <div className="space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Stages &amp; actions</h3>
              {allActions.length === 0 ? (
                <p className="text-xs text-gray-500">No stages.</p>
              ) : (
                <ul className="space-y-3">
                  {allActions.map((s, i) => (
                    <li key={i} className="border-b last:border-b-0 border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{s.stageName}</span>
                        {s.isInitial && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            initial
                          </span>
                        )}
                      </div>
                      {(s.primary.length > 0 || s.secondary.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.primary.map((a, j) => (
                            <span
                              key={`p-${j}`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                            >
                              {a.stage_status_name ?? a.behavior ?? 'action'}
                            </span>
                          ))}
                          {s.secondary.map((a, j) => (
                            <span
                              key={`s-${j}`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                            >
                              {a.stage_status_name ?? a.behavior ?? 'action'}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
