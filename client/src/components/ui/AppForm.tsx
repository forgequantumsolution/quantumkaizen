// AppForm — the project-wide wrapper around AntD Form.
//
// Applies our preferred defaults (vertical layout, optional-mark, no colons,
// short tabular validation messages) so individual forms only specify what is
// unique to them. Re-exports the static surface of AntD's Form (Item, List,
// useForm, …) so call sites import a single name.
import React from 'react';
import { Form, type FormProps } from 'antd';
import type { Store } from 'rc-field-form/lib/interface';

// rc-field-form interpolates ${label}, ${min}, ${max}, ${type} from the rule.
const DEFAULT_VALIDATE_MESSAGES = {
  default: 'Validation failed',
  required: '${label} is required',
  whitespace: '${label} cannot be blank',
  string: {
    min: '${label} must be at least ${min} characters',
    max: '${label} must be at most ${max} characters',
    len: '${label} must be exactly ${len} characters',
  },
  number: {
    min: '${label} must be at least ${min}',
    max: '${label} must be at most ${max}',
    range: '${label} must be between ${min} and ${max}',
  },
  array: {
    min: 'Select at least ${min} items',
    max: 'Select at most ${max} items',
  },
  types: {
    email: 'Enter a valid email',
    url: 'Enter a valid URL',
    number: '${label} must be a number',
  },
};

function AppFormBase<Values = Store>(props: FormProps<Values>): React.ReactElement {
  // Use createElement to bypass JSX's stricter children-type check — AntD's
  // FormProps allows children to be a render-prop function as well as ReactNode,
  // which doesn't fit the JSX <Form>...</Form> shape. The cast to `any` for the
  // props bag avoids the generic Values ↔ unknown variance complaints.
  return React.createElement(
    Form as React.ComponentType<FormProps<Values>>,
    {
      layout: 'vertical',
      requiredMark: 'optional',
      colon: false,
      validateMessages: DEFAULT_VALIDATE_MESSAGES,
      ...props,
    } as FormProps<Values>,
  );
}

// Compose with the static members of antd's Form so consumers can write
// `AppForm.Item`, `AppForm.useForm()`, etc. without a second import.
export const AppForm = Object.assign(AppFormBase, {
  Item: Form.Item,
  List: Form.List,
  ErrorList: Form.ErrorList,
  Provider: Form.Provider,
  useForm: Form.useForm,
  useFormInstance: Form.useFormInstance,
  useWatch: Form.useWatch,
});

export default AppForm;
