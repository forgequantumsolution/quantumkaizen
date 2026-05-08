/**
 * Decision layer — evaluates condition expressions for XOR transitions.
 *
 * Phase 2 supports a tiny expression language:
 *   ${field.path} == 'value'
 *   ${field.path} != 'value'
 *   ${field.path} > 5
 *   ${field.path} < 5
 *   ${field.path}                 (truthy check)
 *
 * The variable namespace is `ticket.customFields`. Phase 3+ may extend to
 * form submissions and other context.
 */

interface DecisionContext {
  ticket: {
    customFields?: Record<string, unknown> | null;
  };
}

const VAR_RE = /\$\{([a-zA-Z0-9_.]+)\}/;
const OP_RE = /^\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/;

const resolveVar = (path: string, ctx: DecisionContext): unknown => {
  const segments = path.split('.');
  if (segments[0] !== 'customFields') return undefined;
  let cur: unknown = ctx.ticket.customFields ?? null;
  for (let i = 1; i < segments.length; i++) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[segments[i] as string];
  }
  return cur;
};

const parseLiteral = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) return asNum;
  return trimmed;
};

/**
 * Evaluate a single condition string. Returns true on parse error so a
 * misconfigured XOR doesn't dead-lock a ticket — call sites can override
 * with stricter handling later.
 */
export const evaluateCondition = (
  expr: string | null | undefined,
  ctx: DecisionContext
): boolean => {
  if (!expr || !expr.trim()) return true;
  const m = expr.match(VAR_RE);
  if (!m) return Boolean(expr.trim());

  const varPath = m[1] as string;
  const value = resolveVar(varPath, ctx);
  const rest = expr.slice(m.index! + m[0].length);

  // Bare variable → truthy check
  if (!rest.trim()) return Boolean(value);

  const opMatch = rest.match(OP_RE);
  if (!opMatch) return Boolean(value);

  const op = opMatch[1] as string;
  const rhs = parseLiteral(opMatch[2] as string);

  switch (op) {
    case '==':
      return value === rhs;
    case '!=':
      return value !== rhs;
    case '>':
      return typeof value === 'number' && typeof rhs === 'number' && value > rhs;
    case '<':
      return typeof value === 'number' && typeof rhs === 'number' && value < rhs;
    case '>=':
      return typeof value === 'number' && typeof rhs === 'number' && value >= rhs;
    case '<=':
      return typeof value === 'number' && typeof rhs === 'number' && value <= rhs;
    default:
      return true;
  }
};
