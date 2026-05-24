// Per-field validation rules + evaluator. Same shape on the wire as the
// `validation` JSON column on FormField.
import type { FormFieldDef } from '../types';

export interface ValidationRules {
  // string
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // number
  min?: number;
  max?: number;
  isInteger?: boolean;
  // date
  minDate?: string;
  maxDate?: string;
  // time
  minTime?: string;
  maxTime?: string;
  // selection (checkbox/multi_text)
  minSelection?: number;
  maxSelection?: number;
  // file
  allowedExtensions?: string;
  maxFileSizeMb?: number;
  // overrides the default error message
  errorMessage?: string;
}

export const STRING_TYPES = new Set(['text', 'textarea', 'richtext', 'password']);
export const NUMBER_TYPES = new Set(['number', 'slider']);
export const DATE_TYPES = new Set(['date']);
export const TIME_TYPES = new Set(['time']);
export const SELECTION_TYPES = new Set(['checkbox', 'multi_text']);
export const FILE_TYPES = new Set(['file', 'image']);

const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

// Returns the first error message for a field, or null when valid.
export const validateField = (field: FormFieldDef, value: unknown): string | null => {
  const rules = (field.validation ?? {}) as ValidationRules;
  const empty = isEmpty(value);

  if (field.required && empty) {
    return rules.errorMessage ?? `${field.label} is required`;
  }
  if (empty) return null; // skip remaining checks for empty-but-not-required

  const type = field.type ?? '';

  if (STRING_TYPES.has(type)) {
    const s = String(value);
    if (rules.minLength !== undefined && s.length < rules.minLength) {
      return rules.errorMessage ?? `${field.label} must be at least ${rules.minLength} characters`;
    }
    if (rules.maxLength !== undefined && s.length > rules.maxLength) {
      return rules.errorMessage ?? `${field.label} must be at most ${rules.maxLength} characters`;
    }
    if (rules.pattern) {
      try {
        const re = new RegExp(rules.pattern);
        if (!re.test(s)) {
          return rules.errorMessage ?? `${field.label} format is invalid`;
        }
      } catch {
        // bad regex — ignore
      }
    }
  }

  if (NUMBER_TYPES.has(type)) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${field.label} must be a number`;
    if (rules.isInteger && !Number.isInteger(n)) {
      return rules.errorMessage ?? `${field.label} must be an integer`;
    }
    if (rules.min !== undefined && n < rules.min) {
      return rules.errorMessage ?? `${field.label} must be ≥ ${rules.min}`;
    }
    if (rules.max !== undefined && n > rules.max) {
      return rules.errorMessage ?? `${field.label} must be ≤ ${rules.max}`;
    }
  }

  if (DATE_TYPES.has(type)) {
    const d = String(value);
    if (rules.minDate && d < rules.minDate) {
      return rules.errorMessage ?? `${field.label} must be on or after ${rules.minDate}`;
    }
    if (rules.maxDate && d > rules.maxDate) {
      return rules.errorMessage ?? `${field.label} must be on or before ${rules.maxDate}`;
    }
  }

  if (TIME_TYPES.has(type)) {
    const t = String(value);
    if (rules.minTime && t < rules.minTime) {
      return rules.errorMessage ?? `${field.label} must be at or after ${rules.minTime}`;
    }
    if (rules.maxTime && t > rules.maxTime) {
      return rules.errorMessage ?? `${field.label} must be at or before ${rules.maxTime}`;
    }
  }

  if (SELECTION_TYPES.has(type) && Array.isArray(value)) {
    if (rules.minSelection !== undefined && value.length < rules.minSelection) {
      return rules.errorMessage ?? `Pick at least ${rules.minSelection} option(s) for ${field.label}`;
    }
    if (rules.maxSelection !== undefined && value.length > rules.maxSelection) {
      return rules.errorMessage ?? `Pick at most ${rules.maxSelection} option(s) for ${field.label}`;
    }
  }

  if (FILE_TYPES.has(type) && typeof value === 'object' && value !== null) {
    const meta = value as { name?: string; size?: number };
    const allowed = (rules.allowedExtensions ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((s) => (s.startsWith('.') ? s : `.${s}`));
    if (allowed.length && meta.name) {
      const lower = meta.name.toLowerCase();
      const ok = allowed.some((ext) => lower.endsWith(ext));
      if (!ok) {
        return rules.errorMessage ?? `${field.label} must be one of: ${allowed.join(', ')}`;
      }
    }
    if (rules.maxFileSizeMb && meta.size && meta.size > rules.maxFileSizeMb * 1024 * 1024) {
      return rules.errorMessage ?? `${field.label} exceeds ${rules.maxFileSizeMb} MB`;
    }
  }

  return null;
};
