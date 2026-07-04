import type { ComponentType } from 'react';
import StageNode from './StageNode';
import ForkNode from './ForkNode';
import JoinNode from './JoinNode';
import DecisionNode from './DecisionNode';
import type { NodeKind } from '../builder.types';
import type { NodeComponentProps } from './types';

export { StageNode, ForkNode, JoinNode, DecisionNode };

// Renderer per node kind. Consumed by `JsPlumbCanvas` to paint each node's
// interior; jsPlumb wraps these with drag/connect behaviour.
export const nodeComponents: Record<NodeKind, ComponentType<NodeComponentProps<any>>> = {
  stage: StageNode,
  fork: ForkNode,
  join: JoinNode,
  decision: DecisionNode,
};
