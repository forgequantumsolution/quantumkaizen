import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

const moduleInfo: Record<string, { title: string; description: string }> = {
  '/qms/capa': {
    title: 'CAPA Management',
    description: 'Corrective & Preventive Actions — full lifecycle from initiation through root cause analysis, action tracking, and effectiveness verification.',
  },
  '/qms/risks': {
    title: 'Risk Register',
    description: 'Risk identification, assessment with configurable likelihood x consequence matrices, control measures, and residual risk evaluation.',
  },
  '/qms/audits': {
    title: 'Audit Management',
    description: 'Schedule, plan, and manage internal/external/supplier audits with checklist builders, finding tracking, and closure workflows.',
  },
  '/qms/fmea': {
    title: 'FMEA',
    description: 'Design and Process FMEA with AIAG-VDA methodology — severity/occurrence/detection ratings, RPN calculation, and action tracking.',
  },
  '/qms/compliance': {
    title: 'Compliance Management',
    description: 'Track regulatory and customer requirements, map standards clauses to procedures, and monitor compliance gaps.',
  },
  '/dms/templates': {
    title: 'Document Templates',
    description: 'Pre-built and custom templates for SOPs, forms, checklists, and records — organized by document type and industry.',
  },
  '/lms/training': {
    title: 'Training Programs',
    description: 'Create and manage training programs with scheduling, assessments, certifications, and Kirkpatrick effectiveness evaluation.',
  },
  '/lms/competency': {
    title: 'Competency Matrix',
    description: 'Define training requirements by role, track completion status, identify gaps, and monitor compliance across departments.',
  },
};

export default function ComingSoonPage() {
  const location = useLocation();
  const info = moduleInfo[location.pathname] || {
    title: 'Module',
    description: 'This module is under development.',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-blue-600-pale flex items-center justify-center mb-6">
        <Construction size={28} className="text-blue-600" strokeWidth={1.5} />
      </div>

      <h1 className="text-h1 text-gray-900 mb-2">{info.title}</h1>

      <p className="text-body text-gray-500 max-w-md mb-8 leading-relaxed">
        {info.description}
      </p>

      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse-soft" />
        <span className="text-xs font-medium text-blue-600">Phase 2 — Coming Soon</span>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-8 text-center">
        <div>
          <p className="text-display text-gray-900">Q2</p>
          <p className="text-xs text-gray-400 mt-1">Target Release</p>
        </div>
        <div>
          <p className="text-display text-gray-900">100%</p>
          <p className="text-xs text-gray-400 mt-1">Spec Complete</p>
        </div>
        <div>
          <p className="text-display text-gray-900">0%</p>
          <p className="text-xs text-gray-400 mt-1">Development</p>
        </div>
      </div>
    </div>
  );
}
