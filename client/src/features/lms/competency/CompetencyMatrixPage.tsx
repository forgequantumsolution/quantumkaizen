import React, { useState, useMemo } from 'react';
import {
  Search,
  Grid3X3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Minus,
  BarChart3,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge } from '@/components/ui';
import Modal from '@/components/ui/Modal';
import { cn, formatDate } from '@/lib/utils';
import { useCompetencyMatrix, useGapAnalysis } from './hooks';
import type { CellStatus, MatrixCell, CompetencyEmployee } from './hooks';

const DEPARTMENTS = ['', 'Quality Assurance', 'Production', 'Engineering'];
const ROLES = [
  '', 'Quality Manager', 'QA Inspector', 'Lab Analyst', 'Document Controller',
  'Production Supervisor', 'Machine Operator', 'Welding Operator', 'Assembly Technician',
  'Design Engineer', 'Process Engineer', 'HSE Officer', 'R&D Engineer',
];

const statusConfig: Record<CellStatus, { bg: string; border: string; text: string; label: string }> = {
  COMPLETED: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', label: 'Completed' },
  EXPIRED: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', label: 'Expired' },
  OVERDUE: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', label: 'Overdue' },
  IN_PROGRESS: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-800', label: 'In Progress' },
  NOT_REQUIRED: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-400', label: 'Not Required' },
  NOT_STARTED: { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-500', label: 'Not Started' },
};

const statusIcons: Record<CellStatus, React.ElementType> = {
  COMPLETED: CheckCircle2,
  EXPIRED: XCircle,
  OVERDUE: AlertTriangle,
  IN_PROGRESS: Clock,
  NOT_REQUIRED: Minus,
  NOT_STARTED: Grid3X3,
};

export default function CompetencyMatrixPage() {
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ employee: CompetencyEmployee; cell: MatrixCell; programTitle: string } | null>(null);

  const filters = useMemo(() => ({
    department: deptFilter || undefined,
    role: roleFilter || undefined,
  }), [deptFilter, roleFilter]);

  const { data: matrix } = useCompetencyMatrix(filters);
  const { data: gapData } = useGapAnalysis(filters);

  // Group employees by department
  const groupedEmployees = useMemo(() => {
    const groups: Record<string, typeof matrix.employees> = {};
    matrix.employees.forEach((emp) => {
      if (!groups[emp.department]) groups[emp.department] = [];
      groups[emp.department].push(emp);
    });
    return groups;
  }, [matrix.employees]);

  const getCellData = (employeeId: string, programId: string): MatrixCell | undefined => {
    return matrix.cells.find((c) => c.employeeId === employeeId && c.programId === programId);
  };

  const handleCellClick = (employee: CompetencyEmployee, programId: string) => {
    const cell = getCellData(employee.id, programId);
    if (!cell) return;
    const program = matrix.programs.find((p) => p.id === programId);
    setSelectedCell({ employee, cell, programTitle: program?.title || '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Competency Matrix</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track training completion and identify competency gaps across the organization
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Gaps</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{gapData.totalGaps}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </Card>

        {gapData.deptCompliance.map((dept) => (
          <Card key={dept.department}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{dept.department}</p>
                <p className={cn('mt-1 text-2xl font-bold', dept.compliance >= 80 ? 'text-emerald-600' : dept.compliance >= 60 ? 'text-amber-600' : 'text-red-600')}>
                  {dept.compliance}%
                </p>
                <p className="text-xs text-slate-400">{dept.employeeCount} employees</p>
              </div>
              <div className="h-10 w-10 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke={dept.compliance >= 80 ? '#10b981' : dept.compliance >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${(dept.compliance / 100) * 97.4} 97.4`}
                  />
                </svg>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.filter(Boolean).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Roles</option>
            {ROLES.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Legend */}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {(Object.entries(statusConfig) as [CellStatus, typeof statusConfig[CellStatus]][]).map(([status, config]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded border', config.bg, config.border)} />
                <span className="text-xs text-slate-500">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Matrix Grid */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-border bg-surface-secondary/50">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[200px]">
                  Employee
                </th>
                {matrix.programs.map((prog) => (
                  <th
                    key={prog.id}
                    className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[80px]"
                    title={prog.title}
                  >
                    {prog.shortCode}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedEmployees).map(([department, employees]) => (
                <React.Fragment key={department}>
                  {/* Department group header */}
                  <tr className="bg-slate-50/70">
                    <td
                      colSpan={matrix.programs.length + 1}
                      className="sticky left-0 z-10 bg-slate-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {department}
                    </td>
                  </tr>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.role}</p>
                        </div>
                      </td>
                      {matrix.programs.map((prog) => {
                        const cell = getCellData(emp.id, prog.id);
                        if (!cell) {
                          return <td key={prog.id} className="px-2 py-2.5 text-center"><div className="h-8 w-8 mx-auto rounded border border-dashed border-slate-200" /></td>;
                        }
                        const config = statusConfig[cell.status];
                        const Icon = statusIcons[cell.status];
                        return (
                          <td key={prog.id} className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => handleCellClick(emp, prog.id)}
                              className={cn(
                                'inline-flex h-8 w-8 items-center justify-center rounded border transition-all',
                                'hover:shadow-md hover:scale-110',
                                config.bg, config.border,
                              )}
                              title={`${emp.name} - ${prog.title}: ${config.label}`}
                            >
                              <Icon className={cn('h-3.5 w-3.5', config.text)} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Gap Analysis Report */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Gap Analysis Report
            </div>
          </CardTitle>
        </CardHeader>

        {gapData.gaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm text-slate-500">All employees are fully compliant!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Employee</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Overdue</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Expired</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Not Started</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {gapData.gaps
                  .sort((a, b) => a.compliancePercent - b.compliancePercent)
                  .map((gap) => (
                    <tr key={gap.employee.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-900">{gap.employee.name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{gap.employee.department}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{gap.employee.role}</td>
                      <td className="px-4 py-2.5 text-center">
                        {gap.overdueCount > 0 ? (
                          <Badge variant="warning">{gap.overdueCount}</Badge>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {gap.expiredCount > 0 ? (
                          <Badge variant="danger">{gap.expiredCount}</Badge>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {gap.notStartedCount > 0 ? (
                          <Badge variant="default">{gap.notStartedCount}</Badge>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-100">
                            <div
                              className={cn(
                                'h-1.5 rounded-full',
                                gap.compliancePercent >= 80 ? 'bg-emerald-500' : gap.compliancePercent >= 60 ? 'bg-amber-500' : 'bg-red-500',
                              )}
                              style={{ width: `${gap.compliancePercent}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              gap.compliancePercent >= 80 ? 'text-emerald-600' : gap.compliancePercent >= 60 ? 'text-amber-600' : 'text-red-600',
                            )}
                          >
                            {gap.compliancePercent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cell Detail Modal */}
      <Modal
        isOpen={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        title="Training Detail"
        size="md"
      >
        {selectedCell && (() => {
          const config = statusConfig[selectedCell.cell.status];
          return (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-900">{selectedCell.employee.name}</p>
                  <Badge variant="outline">{selectedCell.employee.employeeId}</Badge>
                </div>
                <p className="text-xs text-slate-500">{selectedCell.employee.role} - {selectedCell.employee.department}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Training Program</span>
                  <span className="font-medium text-slate-900">{selectedCell.programTitle}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge variant={
                    selectedCell.cell.status === 'COMPLETED' ? 'success'
                    : selectedCell.cell.status === 'EXPIRED' ? 'danger'
                    : selectedCell.cell.status === 'OVERDUE' ? 'warning'
                    : selectedCell.cell.status === 'IN_PROGRESS' ? 'info'
                    : 'default'
                  }>
                    {config.label}
                  </Badge>
                </div>
                {selectedCell.cell.score !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Score</span>
                    <span className="font-medium text-slate-900">{selectedCell.cell.score}%</span>
                  </div>
                )}
                {selectedCell.cell.completionDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Completed</span>
                    <span className="font-medium text-slate-900">{formatDate(selectedCell.cell.completionDate)}</span>
                  </div>
                )}
                {selectedCell.cell.expiryDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Expires</span>
                    <span className="font-medium text-slate-900">{formatDate(selectedCell.cell.expiryDate)}</span>
                  </div>
                )}
                {selectedCell.cell.dueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Due Date</span>
                    <span className={cn(
                      'font-medium',
                      selectedCell.cell.status === 'OVERDUE' ? 'text-amber-600' : 'text-slate-900',
                    )}>
                      {formatDate(selectedCell.cell.dueDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
