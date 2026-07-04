/**
 * Workflow canvas auto-layout via dagre.
 *
 * Positions are no longer persisted in the backend — they're derived from the
 * DAG topology every render. The default is a top-to-bottom (TB) layered
 * layout because the underlying domain is sequential (Submit → Review →
 * Approve), and that reads better than left-to-right for tall sidebars.
 *
 * If the user has dragged a node, we honor the drag for the rest of the
 * session by keeping the canvas node's current `position` (the autolayout
 * is only re-applied on full graph load). Per-user drag persistence isn't
 * stored anywhere; reloading the page snaps back to the auto-layout.
 */
import dagre from 'dagre';
import type { FlowEdge, FlowNode } from './builder.types';

// Empirical sizes for the canvas nodes — match the rendered card dimensions
// in `client/src/features/workflows/builder/nodes/*`. These are best-effort;
// dagre needs concrete numbers to compute non-overlapping coordinates.
const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

export type LayoutDirection = 'TB' | 'LR';

interface LayoutOptions {
  direction?: LayoutDirection;
  /** Spacing between layers along the flow direction. */
  rankSep?: number;
  /** Spacing between nodes within the same layer. */
  nodeSep?: number;
}

/**
 * Compute positions for every node in `nodes` given the DAG in `edges`.
 * Returns a new array of nodes with `position` populated; the original
 * objects are not mutated.
 */
export const layoutGraph = <TData>(
  nodes: FlowNode<TData>[],
  edges: FlowEdge[],
  opts: LayoutOptions = {},
): FlowNode<TData>[] => {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction ?? 'TB',
    nodesep: opts.nodeSep ?? 60,
    ranksep: opts.rankSep ?? 80,
  });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const layouted = g.node(n.id);
    if (!layouted) return n;
    // dagre returns the node's center; React Flow expects top-left.
    return {
      ...n,
      position: {
        x: layouted.x - NODE_WIDTH / 2,
        y: layouted.y - NODE_HEIGHT / 2,
      },
    };
  });
};
