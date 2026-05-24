// Header card above the field table — section name, description, visibility
// rule indicator, and a "Logic" toggle to expand the dependency editor.
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Settings, Trash2 } from 'lucide-react';
import { Button as AntButton, Input as AntInput, Popconfirm } from 'antd';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, isRuleConfigured, summariseRule, type DependencyRule } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  section: FormSectionDef;
  index: number;
  total: number;
  parents: ParentField[];
  onChange: (patch: Partial<FormSectionDef>) => void;
  onMove?: (dir: -1 | 1) => void;
  onDelete?: () => void;
  hidden?: boolean;
}

export default function SectionPanel({
  section, index, total, parents, onChange, onMove, onDelete, hidden,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasLogic = isRuleConfigured(section.dependency);

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <AntInput
              value={section.section_name}
              onChange={(e) => onChange({ section_name: e.target.value })}
              placeholder="Section name"
              variant="borderless"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#0f172a',
                padding: '2px 6px',
                margin: '0 -6px',
                lineHeight: 1.3,
                width: 'auto',
                flex: '1 1 auto',
                minWidth: 120,
                maxWidth: 360,
              }}
            />
            {hasLogic && (
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">
                <Eye className="h-2.5 w-2.5" /> {summariseRule(section.dependency)}
              </span>
            )}
            {hidden && (
              <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                hidden by rule
              </span>
            )}
          </div>
          {(section.description || expanded) && (
            <AntInput.TextArea
              autoSize={{ minRows: 1, maxRows: 4 }}
              value={section.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Add a description (optional)"
              variant="borderless"
              style={{
                fontSize: 12.5,
                color: '#64748b',
                padding: '0 6px',
                margin: '0 -6px',
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onMove && (
            <>
              <AntButton
                type="text"
                size="small"
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
                onClick={() => onMove(-1)}
                disabled={index === 0}
                title="Move section earlier"
              />
              <AntButton
                type="text"
                size="small"
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                onClick={() => onMove(1)}
                disabled={index >= total - 1}
                title="Move section later"
              />
            </>
          )}
          <AntButton
            type={expanded ? 'primary' : 'text'}
            size="small"
            icon={<Settings className="h-3.5 w-3.5" />}
            onClick={() => setExpanded((v) => !v)}
            title="Section visibility rule"
            ghost={expanded}
          >
            Logic
          </AntButton>
          {onDelete && total > 1 && (
            <Popconfirm
              title="Delete this section?"
              description="All fields in this section will be removed."
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={onDelete}
            >
              <AntButton
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-3.5 w-3.5" />}
                title="Delete section"
              />
            </Popconfirm>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
          <DependencyEditor
            scopeLabel="section"
            rule={(section.dependency as DependencyRule | undefined) ?? emptyRule()}
            onChange={(r) => onChange({ dependency: r })}
            parents={parents}
          />
        </div>
      )}
    </div>
  );
}
