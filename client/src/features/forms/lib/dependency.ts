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

/**
 * Defensive parse — tolerates the dependency arriving as a JSON string from
 * older backend versions or hand-edited fixtures.
 */
const parseRule = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const isRuleConfigured = (rule?: unknown): rule is DependencyRule => {
  const parsed = parseRule(rule);
  if (!parsed || typeof parsed !== 'object') return false;
  const r = parsed as Partial<DependencyRule>;
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
  const rule = parseRule(raw) as DependencyRule;
  if (!rule.conditions.length) return true;

  const results = rule.conditions.map((c) => matchCondition(c, lookup));
  const matched = rule.combinator === 'or'
    ? results.some(Boolean)
    : results.every(Boolean);

  const visible = rule.mode === 'show' ? matched : !matched;

  // Enable inline debugging from the browser console:
  //   localStorage.setItem('qk_debug_visibility', '1'); location.reload();
  // Each visibility evaluation is logged so you can see which condition fails.
  if (typeof window !== 'undefined' && window.localStorage?.getItem('qk_debug_visibility') === '1') {
    const details = rule.conditions.map((c, i) => ({
      cond: `${c.sectionName}.${c.fieldName} ${c.operator} ${JSON.stringify(c.value)}`,
      actual: lookup(c.sectionName, c.fieldName),
      result: results[i],
    }));
    // eslint-disable-next-line no-console
    console.debug('[visibility]', { mode: rule.mode, combinator: rule.combinator, visible, details });
  }

  return visible;
};

export const summariseRule = (raw: unknown): string => {
  if (!isRuleConfigured(raw)) return '';
  const r = raw as DependencyRule;
  const verb = r.mode === 'show' ? 'Show when' : 'Hide when';
  return `${verb} ${r.conditions.length} condition${r.conditions.length === 1 ? '' : 's'} (${r.combinator})`;
};

// Walk all sections and patch dependency rules whose references still point
// at the old section/field name. Both edit surfaces (FormBuilderPage,
// FormCreatePage) call this when the user renames a section or a field so
// previously-configured conditions don't silently break — a class of bug
// where the orphaned rule would just always evaluate to false.
export const remapDependencies = <
  S extends {
    section_name: string;
    dependency?: unknown;
    fields: { name: string; dependency?: unknown }[];
  },
>(
  sections: S[],
  matcher: (cond: { sectionName: string; fieldName: string }) =>
    | { sectionName?: string; fieldName?: string }
    | null,
): S[] => {
  const fixRule = (raw: unknown): unknown => {
    if (!raw || typeof raw !== 'object') return raw;
    const rule = raw as DependencyRule;
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) return raw;
    let changed = false;
    const conditions = rule.conditions.map((c) => {
      const patch = matcher({ sectionName: c.sectionName, fieldName: c.fieldName });
      if (!patch) return c;
      changed = true;
      return { ...c, ...patch };
    });
    return changed ? { ...rule, conditions } : raw;
  };
  return sections.map((sec) => ({
    ...sec,
    dependency: fixRule(sec.dependency),
    fields: sec.fields.map((f) => ({ ...f, dependency: fixRule(f.dependency) })),
  })) as S[];
};
