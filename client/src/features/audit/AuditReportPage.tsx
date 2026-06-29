import { Link, useParams } from "react-router-dom";
import { Spin } from "antd";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuditReport, type AuditReport } from "@/lib/api/audit";

export default function AuditReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useAuditReport(id);
  const r = data?.data;

  if (isLoading || !r) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 print:p-0">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <Link
          to={`/audit/register/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          Back to register
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
        >
          <Printer size={14} />
          Print / Save as PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 print:border-0 p-8 print:p-0 text-gray-900">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Audit Report</h1>
              <p className="text-sm text-gray-600 mt-1">{r.register.title}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div className="font-mono text-sm text-gray-800">
                {r.register.register_number}
              </div>
              <div>Generated {new Date(r.generated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Register details */}
        <Section title="Audit Details">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Field
              label="Type"
              value={r.register.audit_type.replace(/_/g, " ")}
            />
            <Field
              label="Status"
              value={r.register.status.replace(/_/g, " ")}
            />
            <Field label="Plant" value={r.register.plant ?? "—"} />
            <Field
              label="Planned Date"
              value={fmtDate(r.register.planned_date)}
            />
            <Field
              label="Financial Year"
              value={r.register.financial_year ?? "—"}
            />
            <Field label="Method" value={r.register.audit_method ?? "—"} />
            <Field
              label="ISO Standard"
              value={r.register.iso_standard ?? "—"}
            />
            <Field label="Template" value={r.register.audit_master ?? "—"} />
            <Field label="Lead Auditor" value={r.register.auditor ?? "—"} />
            <Field label="Approver" value={r.register.approver ?? "—"} />
            <Field label="Approved By" value={r.register.approved_by ?? "—"} />
            <Field
              label="Approved At"
              value={
                r.register.approved_at ? fmtDate(r.register.approved_at) : "—"
              }
            />
          </dl>
          {r.register.description && (
            <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">
              {r.register.description}
            </p>
          )}
        </Section>

        {/* Execution */}
        {r.program && (
          <Section title="Execution">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              <Field label="Program #" value={r.program.program_number} />
              <Field
                label="Status"
                value={r.program.status.replace(/_/g, " ")}
              />
              <Field
                label="Started"
                value={
                  r.program.started_at ? fmtDate(r.program.started_at) : "—"
                }
              />
              <Field
                label="Completed"
                value={
                  r.program.completed_at ? fmtDate(r.program.completed_at) : "—"
                }
              />
              <Field
                label="Score"
                value={r.program.score == null ? "—" : String(r.program.score)}
              />
            </dl>
            {r.program.summary && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Summary
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {r.program.summary}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* Findings summary */}
        <Section title="Findings Summary">
          <div className="flex gap-4 text-sm">
            <Stat label="Total" value={r.summary.total_findings} />
            {["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"].map((s) => (
              <Stat
                key={s}
                label={s[0] + s.slice(1).toLowerCase()}
                value={r.summary.by_severity[s] ?? 0}
              />
            ))}
          </div>
        </Section>

        {/* Findings detail */}
        <Section title="Findings & Remediation">
          {r.findings.length === 0 ? (
            <p className="text-sm text-gray-500">No findings recorded.</p>
          ) : (
            <div className="space-y-4">
              {r.findings.map((f) => (
                <div
                  key={f.finding_number}
                  className="border border-gray-200 rounded-lg p-3 break-inside-avoid"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-800">
                      {f.finding_number}
                    </span>
                    <span className="text-xs">
                      <Tag>{f.severity}</Tag>{" "}
                      <Tag>{f.status.replace(/_/g, " ")}</Tag>
                    </span>
                  </div>
                  {f.clause_ref && (
                    <div className="text-xs text-gray-500 mt-1">
                      Clause: {f.clause_ref}
                    </div>
                  )}
                  <p className="text-sm text-gray-800 mt-1">{f.description}</p>
                  {f.recommendation && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Recommendation: </span>
                      {f.recommendation}
                    </p>
                  )}
                  {f.non_conformance && (
                    <div className="mt-2 pl-3 border-l-2 border-amber-300 text-sm">
                      <div className="text-xs text-gray-600">
                        <span className="font-mono">
                          {f.non_conformance.nc_number}
                        </span>{" "}
                        · {f.non_conformance.status.replace(/_/g, " ")}
                        {f.non_conformance.department
                          ? ` · ${f.non_conformance.department}`
                          : ""}
                      </div>
                      {f.non_conformance.capa && (
                        <div className="mt-1 text-xs text-gray-700">
                          <div>
                            <span className="font-mono">
                              {f.non_conformance.capa.capa_number}
                            </span>{" "}
                            ({f.non_conformance.capa.type}) ·{" "}
                            {f.non_conformance.capa.status.replace(/_/g, " ")}
                            {f.non_conformance.capa.owner
                              ? ` · ${f.non_conformance.capa.owner}`
                              : ""}
                          </div>
                          {f.non_conformance.capa.root_cause && (
                            <div className="mt-0.5">
                              Root cause: {f.non_conformance.capa.root_cause}
                            </div>
                          )}
                          {f.non_conformance.capa.corrective_action && (
                            <div>
                              Corrective:{" "}
                              {f.non_conformance.capa.corrective_action}
                            </div>
                          )}
                          {f.non_conformance.capa.preventive_action && (
                            <div>
                              Preventive:{" "}
                              {f.non_conformance.capa.preventive_action}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Signatures */}
        <Section title="Electronic Signatures">
          {r.signatures.length === 0 ? (
            <p className="text-sm text-gray-500">
              No electronic signatures applied.
            </p>
          ) : (
            <ul className="text-sm space-y-1">
              {r.signatures.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    <span className="font-medium">{s.meaning}</span> —{" "}
                    {s.user_name}
                  </span>
                  <span className="text-gray-500">
                    {new Date(s.signed_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-semibold text-gray-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border border-gray-300 rounded px-1.5 py-0.5 text-[10px] text-gray-700">
      {children}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString();
}

export type { AuditReport };
