// Dependency rule shape + evaluator. Used by both the builder (for live
// preview and inspector) and the fill page. Stored on field/section as JSON
// in `dependency`, deserialised here as `DependencyRule`.

export type DependencyOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty';

export interface DependencyCondition {
  sectionName: string;
  fieldName: string;
  operator: DependencyOperator;
  value?: string | string[];
}

export interface DependencyRule {
  enabled: boolean;
  mode: 'show' | 'hide';        // show: visible only when conditions match
  combinator: 'and' | 'or';
  conditions: DependencyCondition[];
}

export const emptyRule = (): DependencyRule => ({
  enabled: false,
  mode: 'show',
  combinator: 'and',
  conditions: [],
});

export const isRuleConfigured = (rule?: unknown): rule is DependencyRule => {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as Partial<DependencyRule>;
  return !!(r.enabled && Array.isArray(r.conditions) && r.conditions.length > 0);
};

export type FieldValueLookup = (sectionName: string, fieldName: string) => unknown;

const matchCondition = (cond: DependencyCondition, lookup: FieldValueLookup): boolean => {
  const actual = lookup(cond.sectionName, cond.fieldName);
  const expected = cond.value;

  switch (cond.operator) {
    case 'is_empty':
      return actual === undefined || actual === null || actual === '' ||
        (Array.isArray(actual) && actual.length === 0);
    case 'is_not_empty':
      return !(actual === undefined || actual === null || actual === '' ||
        (Array.isArray(actual) && actual.length === 0));
    case 'equals':
      if (Array.isArray(actual)) return actual.includes(expected as string);
      return String(actual ?? '') === String(expected ?? '');
    case 'not_equals':
      if (Array.isArray(actual)) return !actual.includes(expected as string);
      return String(actual ?? '') !== String(expected ?? '');
    case 'in': {
      const list = Array.isArray(expected) ? expected : [expected as string];
      if (Array.isArray(actual)) return actual.some((v) => list.includes(String(v)));
      return list.includes(String(actual ?? ''));
    }
    case 'not_in': {
      const list = Array.isArray(expected) ? expected : [expected as string];
      if (Array.isArray(actual)) return !actual.some((v) => list.includes(String(v)));
      return !list.includes(String(actual ?? ''));
    }
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(expected as string);
      return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    default:
      return true;
  }
};

// Returns true when the field/section should be visible.
// `mode = 'show'`: visible only when the conditions evaluate true.
// `mode = 'hide'`: hidden when the conditions evaluate true (i.e., default visible).
export const evaluateVisibility = (
  raw: unknown,
  lookup: FieldValueLookup
): boolean => {
  if (!isRuleConfigured(raw)) return true;
  const rule = raw as DependencyRule;
  if (!rule.conditions.length) return true;

  const results = rule.conditions.map((c) => matchCondition(c, lookup));
  const matched = rule.combinator === 'or'
    ? results.some(Boolean)
    : results.every(Boolean);

  return rule.mode === 'show' ? matched : !matched;
};

export const summariseRule = (raw: unknown): string => {
  if (!isRuleConfigured(raw)) return '';
  const r = raw as DependencyRule;
  const verb = r.mode === 'show' ? 'Show when' : 'Hide when';
  return `${verb} ${r.conditions.length} condition${r.conditions.length === 1 ? '' : 's'} (${r.combinator})`;
};
