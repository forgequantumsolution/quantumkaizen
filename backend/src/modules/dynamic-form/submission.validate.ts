// Server-side mirror of the client-side validation + dependency logic.
// Keeps the wire shape identical, so a malicious client can't bypass rules.
type Operator =
  | 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains'
  | 'is_empty' | 'is_not_empty';

type Lookup = (sectionName: string, fieldName: string) => unknown;

interface Condition { sectionName: string; fieldName: string; operator: Operator; value?: unknown }
interface Rule {
  enabled: boolean;
  mode: 'show' | 'hide';
  combinator: 'and' | 'or';
  conditions: Condition[];
}

const STRING = new Set(['text', 'textarea', 'richtext', 'password']);
const NUMBER = new Set(['number', 'slider']);
const DATE = new Set(['date']);
const TIME = new Set(['time']);
const SELECTION = new Set(['checkbox', 'multi_text']);

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' ||
  (Array.isArray(v) && v.length === 0);

const matchCondition = (c: Condition, get: Lookup): boolean => {
  const a = get(c.sectionName, c.fieldName);
  const e = c.value;
  switch (c.operator) {
    case 'is_empty':     return isEmpty(a);
    case 'is_not_empty': return !isEmpty(a);
    case 'equals':       return Array.isArray(a) ? a.includes(e) : String(a ?? '') === String(e ?? '');
    case 'not_equals':   return !(Array.isArray(a) ? a.includes(e) : String(a ?? '') === String(e ?? ''));
    case 'in': {
      const list = Array.isArray(e) ? e : [e];
      return Array.isArray(a) ? a.some((v) => list.includes(v)) : list.includes(a);
    }
    case 'not_in': {
      const list = Array.isArray(e) ? e : [e];
      return Array.isArray(a) ? !a.some((v) => list.includes(v)) : !list.includes(a);
    }
    case 'contains':
      return String(a ?? '').toLowerCase().includes(String(e ?? '').toLowerCase());
    default: return true;
  }
};

const visible = (rule: unknown, get: Lookup): boolean => {
  if (!rule || typeof rule !== 'object') return true;
  const r = rule as Partial<Rule>;
  if (!r.enabled || !Array.isArray(r.conditions) || r.conditions.length === 0) return true;
  const results = r.conditions.map((c) => matchCondition(c, get));
  const matched = r.combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
  return r.mode === 'hide' ? !matched : matched;
};

interface FieldSchema {
  name: string;
  label: string;
  type: string | null;
  required: boolean;
  options: unknown;
  validation: unknown;
  dependency: unknown;
}

interface SectionSchema {
  section_name: string;
  dependency: unknown;
  fields: FieldSchema[];
}

interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  isInteger?: boolean;
  minDate?: string;
  maxDate?: string;
  minTime?: string;
  maxTime?: string;
  minSelection?: number;
  maxSelection?: number;
  errorMessage?: string;
}

const fieldError = (f: FieldSchema, value: unknown): string | null => {
  const rules = (f.validation ?? {}) as ValidationRules;
  if (f.required && isEmpty(value)) return rules.errorMessage ?? `${f.label} is required`;
  if (isEmpty(value)) return null;

  const t = f.type ?? '';
  if (STRING.has(t)) {
    const s = String(value);
    if (rules.minLength !== undefined && s.length < rules.minLength)
      return rules.errorMessage ?? `${f.label} must be at least ${rules.minLength} characters`;
    if (rules.maxLength !== undefined && s.length > rules.maxLength)
      return rules.errorMessage ?? `${f.label} must be at most ${rules.maxLength} characters`;
    if (rules.pattern) {
      try {
        if (!new RegExp(rules.pattern).test(s))
          return rules.errorMessage ?? `${f.label} format is invalid`;
      } catch { /* bad regex — ignore */ }
    }
  }
  if (NUMBER.has(t)) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${f.label} must be a number`;
    if (rules.isInteger && !Number.isInteger(n))
      return rules.errorMessage ?? `${f.label} must be an integer`;
    if (rules.min !== undefined && n < rules.min)
      return rules.errorMessage ?? `${f.label} must be ≥ ${rules.min}`;
    if (rules.max !== undefined && n > rules.max)
      return rules.errorMessage ?? `${f.label} must be ≤ ${rules.max}`;
  }
  if (DATE.has(t)) {
    const d = String(value);
    if (rules.minDate && d < rules.minDate)
      return rules.errorMessage ?? `${f.label} must be on or after ${rules.minDate}`;
    if (rules.maxDate && d > rules.maxDate)
      return rules.errorMessage ?? `${f.label} must be on or before ${rules.maxDate}`;
  }
  if (TIME.has(t)) {
    const v = String(value);
    if (rules.minTime && v < rules.minTime)
      return rules.errorMessage ?? `${f.label} must be at or after ${rules.minTime}`;
    if (rules.maxTime && v > rules.maxTime)
      return rules.errorMessage ?? `${f.label} must be at or before ${rules.maxTime}`;
  }
  if (SELECTION.has(t) && Array.isArray(value)) {
    if (rules.minSelection !== undefined && value.length < rules.minSelection)
      return rules.errorMessage ?? `Pick at least ${rules.minSelection} option(s) for ${f.label}`;
    if (rules.maxSelection !== undefined && value.length > rules.maxSelection)
      return rules.errorMessage ?? `Pick at most ${rules.maxSelection} option(s) for ${f.label}`;
  }
  return null;
};

export interface ValidationFailure {
  section: string;
  field: string;
  message: string;
}

// Validates a SUBMITTED response against a saved form structure. Skips
// fields hidden by their (or their section's) dependency rule.
export const validateSubmission = (
  sections: SectionSchema[],
  responses: Record<string, Record<string, unknown>>
): ValidationFailure[] => {
  // Tolerate stale dependency rules whose `sectionName` references a renamed
  // section. Mirrors the client-side fallback in FormFillEmbed.lookup —
  // server must agree or required-field checks diverge from the UI.
  const get: Lookup = (s, f) => {
    const direct = responses[s]?.[f];
    if (direct !== undefined) return direct;
    if (!(s in responses)) {
      for (const sec of Object.values(responses)) {
        if (sec && f in sec) return sec[f];
      }
    }
    return undefined;
  };
  const errors: ValidationFailure[] = [];
  for (const sec of sections) {
    if (!visible(sec.dependency, get)) continue;
    for (const f of sec.fields) {
      if (!visible(f.dependency, get)) continue;
      const err = fieldError(f, responses[sec.section_name]?.[f.name]);
      if (err) errors.push({ section: sec.section_name, field: f.name, message: err });
    }
  }
  return errors;
};
