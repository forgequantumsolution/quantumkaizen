import StageNode from './StageNode';
import ForkNode from './ForkNode';
import JoinNode from './JoinNode';
import DecisionNode from './DecisionNode';

export { StageNode, ForkNode, JoinNode, DecisionNode };

export const nodeTypes = {
  stage: StageNode,
  fork: ForkNode,
  join: JoinNode,
  decision: DecisionNode,
};
