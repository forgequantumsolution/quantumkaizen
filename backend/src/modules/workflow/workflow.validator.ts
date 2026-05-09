import type { WorkflowEdge, WorkflowNode } from './workflow.schema';

const STRUCTURAL_NODE_TYPES = new Set(['fork', 'join', 'decision']);

const getNodeType = (node: WorkflowNode): string =>
  node.type ?? node.data.nodeType ?? 'stage';

const getNodeLabel = (node: WorkflowNode): string =>
  node.data.label?.trim() || node.id;

export const validateWorkflowStructure = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] => {
  const errors: string[] = [];

  if (!nodes || nodes.length === 0) {
    errors.push('Workflow must have at least one stage');
    return errors;
  }

  const nodesById = new Map<string, WorkflowNode>();
  for (const node of nodes) nodesById.set(node.id, node);

  // Check 2 — exactly one initial stage
  const initialStages = nodes.filter(
    (n) => n.data.basic_details?.is_initial_stage === true
  );
  if (initialStages.length === 0) {
    errors.push('Workflow must have one initial stage');
  } else if (initialStages.length > 1) {
    errors.push(
      `Workflow can only have one initial stage, found ${initialStages.length}`
    );
  }

  // Check 3 — every edge references valid nodes
  for (const edge of edges) {
    if (!nodesById.has(edge.source)) {
      errors.push(`Edge references non-existent source node: ${edge.source}`);
    }
    if (!nodesById.has(edge.target)) {
      errors.push(`Edge references non-existent target node: ${edge.target}`);
    }
  }

  // Check 4 — no orphaned nodes (only matters if there's more than one node)
  if (nodes.length > 1) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    for (const node of nodes) {
      const isInitial = node.data.basic_details?.is_initial_stage === true;
      const label = getNodeLabel(node);
      if (isInitial) {
        const hasOutgoing = edges.some((e) => e.source === node.id);
        if (!hasOutgoing) {
          errors.push(`Initial stage '${label}' has no outgoing connections`);
        }
      } else if (!connected.has(node.id)) {
        errors.push(`Stage '${label}' is not connected to workflow`);
      }
    }
  }

  // Check 5/6 — fork/join structure
  for (const node of nodes) {
    const nodeType = getNodeType(node);
    const label = getNodeLabel(node);
    const cfg = node.data.parallelConfig ?? {};
    const branchCount = cfg.branchCount ?? 0;

    if (nodeType === 'fork') {
      if (!branchCount || branchCount < 2) {
        errors.push(`Fork node '${label}' must have at least 2 branches configured`);
      }

      const incoming = edges.filter((e) => e.target === node.id);
      if (incoming.length !== 1) {
        errors.push(
          `Fork node '${label}' must have exactly 1 incoming connection (found ${incoming.length})`
        );
      }

      const outgoing = edges.filter((e) => e.source === node.id);
      if (branchCount && outgoing.length !== branchCount) {
        errors.push(
          `Fork node '${label}' must have ${branchCount} outgoing connections (found ${outgoing.length})`
        );
      }

      const usedHandles = new Set<string>();
      for (const edge of outgoing) {
        if (edge.sourceHandle && edge.sourceHandle.startsWith('branch-')) {
          usedHandles.add(edge.sourceHandle);
        }
      }
      if (usedHandles.size > 0 && branchCount > 0) {
        const expected = new Set<string>();
        for (let i = 0; i < branchCount; i++) expected.add(`branch-${i}`);
        const missing = [...expected].filter((h) => !usedHandles.has(h));
        if (missing.length) {
          errors.push(
            `Fork node '${label}' missing connections for branches: ${missing.sort().join(', ')}`
          );
        }
      }
    } else if (nodeType === 'join') {
      const joinType = cfg.joinType ?? 'AND';
      if (!branchCount || branchCount < 2) {
        errors.push(`Join node '${label}' must have at least 2 branches configured`);
      }

      const incoming = edges.filter((e) => e.target === node.id);
      if (branchCount && incoming.length !== branchCount) {
        errors.push(
          `Join node '${label}' must have ${branchCount} incoming connections (found ${incoming.length})`
        );
      }

      const usedHandles = new Set<string>();
      for (const edge of incoming) {
        if (edge.targetHandle && edge.targetHandle.startsWith('branch-')) {
          usedHandles.add(edge.targetHandle);
        }
      }
      if (usedHandles.size > 0 && branchCount > 0) {
        const expected = new Set<string>();
        for (let i = 0; i < branchCount; i++) expected.add(`branch-${i}`);
        const missing = [...expected].filter((h) => !usedHandles.has(h));
        if (missing.length) {
          errors.push(
            `Join node '${label}' missing connections for branches: ${missing.sort().join(', ')}`
          );
        }
      }

      const outgoing = edges.filter((e) => e.source === node.id);
      if (outgoing.length !== 1) {
        errors.push(
          `Join node '${label}' must have exactly 1 outgoing connection (found ${outgoing.length})`
        );
      }

      if (joinType !== 'AND' && joinType !== 'OR') {
        errors.push(`Join node '${label}' has invalid join type '${joinType}'`);
      }
    }
  }

  // Check 7 — balanced fork/join
  const forkCount = nodes.filter((n) => getNodeType(n) === 'fork').length;
  const joinCount = nodes.filter((n) => getNodeType(n) === 'join').length;
  if (forkCount !== joinCount) {
    errors.push(
      `Unbalanced Fork/Join: ${forkCount} fork(s) but ${joinCount} join(s)`
    );
  }

  // Check 8 — cycle detection (Kahn's topological sort)
  if (nodes.length > 1 && edges.length > 0) {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    for (const edge of edges) {
      if (adjacency.has(edge.source) && inDegree.has(edge.target)) {
        adjacency.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      }
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }
    let visited = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited++;
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }
    if (visited < nodes.length) {
      errors.push(
        'Workflow contains a cycle — stages cannot form a loop. Please remove circular connections.'
      );
    }
  }

  // Check 9 — unique stage names (non-structural only)
  const seenNames = new Map<string, string>();
  for (const node of nodes) {
    const nodeType = getNodeType(node);
    if (STRUCTURAL_NODE_TYPES.has(nodeType)) continue;
    const name = (node.data.label ?? '').trim();
    if (!name) {
      errors.push(`Stage ${node.id} has no name — every stage must have a name`);
      continue;
    }
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      errors.push(
        `Duplicate stage name '${name}' — stage names must be unique within a workflow`
      );
    } else {
      seenNames.set(key, node.id);
    }
  }

  return errors;
};
