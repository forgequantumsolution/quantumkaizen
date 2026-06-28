import { FormSubmissionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { validateSubmission } from './submission.validate';
import {
  assertCanReadForm,
  bindingAccessSelect,
} from '../stage-form/stage-form.access';

const json = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);
import type {
  ListSubmissionsQuery,
  SubmitFormInput,
  UpdateSubmissionStatusInput,
} from './submission.schema';

const baseInclude = {
  form: { select: { id: true, title: true, version: true, versionId: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
  stage: { select: { id: true, name: true, canonicalId: true } },
} satisfies Prisma.FormSubmissionInclude;

export const submit = async (
  formId: string,
  input: SubmitFormInput,
  userId?: string
) => {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: {
          fields: {
            where: { parentFieldId: null },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });
  if (!form) throw NotFound('Form not found');

  const status =
    input.status === 'SUBMITTED'
      ? FormSubmissionStatus.SUBMITTED
      : FormSubmissionStatus.IN_PROGRESS;

  // Server-side validation only on final submission. Drafts can hold partial data.
  if (status === FormSubmissionStatus.SUBMITTED) {
    const failures = validateSubmission(
      form.sections.map((s) => ({
        section_name: s.name,
        dependency: s.dependency,
        fields: s.fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.typeName ?? null,
          required: f.required,
          options: f.options,
          validation: f.validation,
          dependency: f.dependency,
        })),
      })),
      (input.responses ?? {}) as Record<string, Record<string, unknown>>
    );
    if (failures.length) {
      throw BadRequest(`${failures.length} field${failures.length === 1 ? '' : 's'} failed validation`, failures);
    }
  }

  return prisma.formSubmission.create({
    data: {
      formId,
      versionId: form.versionId,
      responses: input.responses as Prisma.InputJsonValue,
      meta: json(input.meta),
      status,
      submittedById: userId ?? null,
      submittedAt: status === FormSubmissionStatus.SUBMITTED ? new Date() : null,
    },
    include: baseInclude,
  });
};

export const list = async (q: ListSubmissionsQuery) => {
  const where: Prisma.FormSubmissionWhereInput = {};
  if (q.form_id) where.formId = q.form_id;
  if (q.status) where.status = q.status;
  if (q.submitted_by) where.submittedById = q.submitted_by;
  if (q.ticket_id) where.ticketId = q.ticket_id;

  const [items, total] = await Promise.all([
    prisma.formSubmission.findMany({
      where,
      include: baseInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.formSubmission.count({ where }),
  ]);

  return { items, total, page: q.page, page_size: q.page_size };
};

export const get = async (id: string, userId?: string) => {
  const sub = await prisma.formSubmission.findUnique({
    where: { id },
    include: {
      ...baseInclude,
      // Workflow-bound submissions carry a binding whose access lists gate
      // who may read them. Standalone submissions (no binding) are unchanged.
      binding: { select: bindingAccessSelect },
    },
  });
  if (!sub) throw NotFound('Submission not found');

  if (sub.binding && userId) {
    await assertCanReadForm(prisma, sub.binding, userId);
  }

  // Don't leak the binding's access lists in the response shape.
  const { binding: _binding, ...rest } = sub;
  return rest;
};

export const updateStatus = async (id: string, input: UpdateSubmissionStatusInput) => {
  const sub = await prisma.formSubmission.findUnique({ where: { id } });
  if (!sub) throw NotFound('Submission not found');

  const status = FormSubmissionStatus[input.status];
  return prisma.formSubmission.update({
    where: { id },
    data: {
      status,
      submittedAt:
        status === FormSubmissionStatus.SUBMITTED && !sub.submittedAt
          ? new Date()
          : sub.submittedAt,
    },
    include: baseInclude,
  });
};

export const remove = async (id: string) => {
  const sub = await prisma.formSubmission.findUnique({ where: { id } });
  if (!sub) throw NotFound('Submission not found');
  await prisma.formSubmission.delete({ where: { id } });
};
