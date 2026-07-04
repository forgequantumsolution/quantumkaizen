import { useState } from 'react';
import {
  ArrowRight,
  CircleDot,
  GitBranch,
  Merge,
  MousePointer2,
  Plus,
  Spline,
  Split,
  Trash2,
} from 'lucide-react';
import { Button, Select } from '@/components/ui';
import StageInspector from './StageInspector';
import ForkInspector from './ForkInspector';
import JoinInspector from './JoinInspector';
import DecisionInspector from './DecisionInspector';
import type {
  DecisionNodeData,
  ForkNodeData,
  JoinNodeData,
  NodeKind,
  StageNodeData,
  WorkflowFlowEdge,
  WorkflowFlowNode,
  WorkflowNodeData,
} from '../builder.types';
import type { WorkflowStageStatus } from '@/lib/api/workflowLookups';

interface Props {
  workflowId: string;
  selectedNode: WorkflowFlowNode | null;
  onNodeUpdate: (id: string, data: WorkflowNodeData) => void;
  onNodeDelete: (id: string) => void;
  allNodes: WorkflowFlowNode[];
  stageStatuses: WorkflowStageStatus[];
  edges: WorkflowFlowEdge[];
  onConnect: (source: string, target: string) => void;
  onDisconnect: (source: string, target: string) => void;
}

const nodeLabel = (n: WorkflowFlowNode): string =>
  (n.data as { label?: string }).label || 'Untitled';

/**
 * Panel-side alternative to dragging the gold handle on the canvas: pick a
 * target stage and wire the selected node to it. Outgoing links can be added or
 * removed here; incoming links are listed read-only (remove from their source).
 */
function ConnectionsSection({
  selectedNode,
  allNodes,
  edges,
  onConnect,
  onDisconnect,
}: {
  selectedNode: WorkflowFlowNode;
  allNodes: WorkflowFlowNode[];
  edges: WorkflowFlowEdge[];
  onConnect: (source: string, target: string) => void;
  onDisconnect: (source: string, target: string) => void;
}) {
  const [targetId, setTargetId] = useState('');
  const byId = (id: string) => allNodes.find((n) => n.id === id);
  const outgoing = edges.filter((e) => e.source === selectedNode.id);
  const incoming = edges.filter((e) => e.target === selectedNode.id);
  const candidates = allNodes.filter(
    (n) => n.id !== selectedNode.id && !outgoing.some((e) => e.target === n.id),
  );

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/40">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: '#EEF2FF', color: '#6366F1' }}
        >
          <Spline size={13} strokeWidth={2} />
        </span>
        <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          Connections
        </h4>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Connects to
          </div>
          {outgoing.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic px-0.5">
              No outgoing connections yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {outgoing.map((e) => {
                const t = byId(e.target);
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-1.5"
                  >
                    <ArrowRight size={13} className="text-indigo-500 shrink-0" />
                    <span className="flex-1 min-w-0 text-[13px] text-gray-800 truncate">
                      {t ? nodeLabel(t) : 'Unknown'}
                    </span>
                    <button
                      type="button"
                      aria-label="remove connection"
                      onClick={() => onDisconnect(e.source, e.target)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={candidates.length === 0}
            options={[
              {
                value: '',
                label: candidates.length ? 'Select a stage…' : 'No stages available',
              },
              ...candidates.map((n) => ({ value: n.id, label: nodeLabel(n) })),
            ]}
            className="flex-1 !bg-white"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!targetId}
            onClick={() => {
              if (!targetId) return;
              onConnect(selectedNode.id, targetId);
              setTargetId('');
            }}
          >
            <Plus size={14} />
            <span className="ml-1">Connect</span>
          </Button>
        </div>

        {incoming.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Connected from
            </div>
            <div className="space-y-1.5">
              {incoming.map((e) => {
                const s = byId(e.source);
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-1.5"
                  >
                    <ArrowRight size={13} className="text-gray-300 shrink-0" />
                    <span className="flex-1 min-w-0 text-[12px] text-gray-500 truncate">
                      {s ? nodeLabel(s) : 'Unknown'}
                    </span>
                    <button
                      type="button"
                      aria-label="remove connection"
                      onClick={() => onDisconnect(e.source, e.target)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_META: Record<
  NodeKind,
  { label: string; icon: React.ElementType; color: string; tint: string; ring: string }
> = {
  stage: { label: 'Stage', icon: CircleDot, color: '#475569', tint: '#F1F5F9', ring: '#E2E8F0' },
  fork: { label: 'Fork', icon: Split, color: '#7C3AED', tint: '#F5F3FF', ring: '#DDD6FE' },
  join: { label: 'Join', icon: Merge, color: '#6D28D9', tint: '#EDE9FE', ring: '#DDD6FE' },
  decision: {
    label: 'Decision',
    icon: GitBranch,
    color: '#D97706',
    tint: '#FFFBEB',
    ring: '#FDE68A',
  },
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm overflow-hidden flex flex-col">
    {children}
  </div>
);

export default function InspectorPanel({
  workflowId,
  selectedNode,
  onNodeUpdate,
  onNodeDelete,
  allNodes,
  stageStatuses,
  edges,
  onConnect,
  onDisconnect,
}: Props) {
  if (!selectedNode) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
          <span className="w-12 h-12 rounded-2xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center text-gray-300">
            <MousePointer2 size={22} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Inspector</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              Select a node on the canvas to edit its properties.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const kind = (selectedNode.type ?? 'stage') as NodeKind;
  const meta = KIND_META[kind] ?? KIND_META.stage;
  const Icon = meta.icon;
  const handleChange = (data: WorkflowNodeData) => onNodeUpdate(selectedNode.id, data);

  return (
    <Shell>
      {/* Header with node-type identity + delete. */}
      <div
        className="px-4 py-3.5 border-b border-gray-100"
        style={{ background: `linear-gradient(180deg, ${meta.tint} 0%, #FFFFFF 100%)` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1"
            style={{ backgroundColor: '#fff', color: meta.color, boxShadow: `0 0 0 1px ${meta.ring}` }}
          >
            <Icon size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label} settings
            </div>
            <div className="text-sm font-semibold text-gray-900 truncate">
              {(selectedNode.data as { label?: string }).label || 'Untitled'}
            </div>
          </div>
          <button
            onClick={() => onNodeDelete(selectedNode.id)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg px-2 py-1.5 transition-colors"
            title="Delete this node"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3.5">
        <ConnectionsSection
          selectedNode={selectedNode}
          allNodes={allNodes}
          edges={edges}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
        {kind === 'stage' && (
          <StageInspector
            workflowId={workflowId}
            data={selectedNode.data as StageNodeData}
            onChange={handleChange}
            stageStatuses={stageStatuses}
          />
        )}
        {kind === 'fork' && (
          <ForkInspector
            data={selectedNode.data as ForkNodeData}
            onChange={handleChange}
            allNodes={allNodes}
          />
        )}
        {kind === 'join' && (
          <JoinInspector data={selectedNode.data as JoinNodeData} onChange={handleChange} />
        )}
        {kind === 'decision' && (
          <DecisionInspector data={selectedNode.data as DecisionNodeData} onChange={handleChange} />
        )}
      </div>
    </Shell>
  );
}
