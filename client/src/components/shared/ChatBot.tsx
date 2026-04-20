import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

const RULES: { patterns: RegExp[]; response: string }[] = [
  {
    patterns: [/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/i],
    response: "Hello! I'm QMS Assistant, your guide to Quantum Kaizen. Ask me about modules like Non-Conformances, CAPA, FMEA, Audits, Complaints, Document Management, Inspection, Calibration, and GMP standards. What would you like to know?",
  },
  {
    patterns: [/what.*platform|about.*quantum kaizen|overview.*system|what.*modules/i],
    response: "**Quantum Kaizen** is a pharma QMS platform covering:\n• **QMS**: Non-Conformances, CAPA, FMEA, Risk, Change Control, Complaints, Suppliers, Audits\n• **DMS**: Document lifecycle (SOPs, BMRs, specs, protocols)\n• **Inspection**: Incoming, in-process & final inspection records\n• **Calibration**: Equipment calibration scheduling & certificates\n• **LMS**: Training & GMP compliance tracking\n• **Analytics**: Real-time KPI dashboard",
  },
  {
    patterns: [/\bnc\b|non.?conform/i],
    response: "**Non-Conformance (NC) Module**\nTrack product and process deviations:\n• Classify by severity: Critical / Major / Minor\n• Link to CAPA for root cause analysis\n• Dashboard shows NC trend and severity breakdown\n• Products: Paracetamol 500mg, Metformin 500mg, Amoxicillin 250mg, Ondansetron 4mg, Ceftriaxone 1g, Omeprazole 20mg\n• Navigate: QMS → Non-Conformances",
  },
  {
    patterns: [/\bcapa\b|corrective.*preventive|corrective action/i],
    response: "**CAPA Module**\nCorrective and Preventive Action management:\n• 7-stage workflow: Initiated → Containment → Root Cause → Action Defn → Implementation → Effectiveness → Closed\n• 5-Why and Fishbone analysis built-in\n• CAPA closure rate KPI tracked on dashboard\n• Navigate: QMS → CAPA",
  },
  {
    patterns: [/\bfmea\b|failure mode|risk analysis.*product/i],
    response: "**FMEA Module**\nFailure Mode & Effects Analysis (ICH Q9):\n• PFMEA (Process) and DFMEA (Design) types\n• RPN = Severity × Occurrence × Detection\n• Products: Paracetamol Compression, Ondansetron Aseptic Fill, Amoxicillin Encapsulation, Purified Water System, Metformin Wet Granulation\n• Navigate: QMS → FMEA",
  },
  {
    patterns: [/\brisk\b(?!.*analysis.*product)|risk management|risk register/i],
    response: "**Risk Register**\nQuality risk management per ICH Q9:\n• 5 categories: Quality, Operational, Safety, Environmental, Financial\n• Likelihood × Impact scoring matrix\n• Risk scatter plot visualization on dashboard\n• 14 pharma risks tracked\n• Navigate: QMS → Risk Register",
  },
  {
    patterns: [/complaint|customer complaint/i],
    response: "**Complaints Module**\nCustomer complaint management:\n• Log by product, batch number, and customer\n• Auto-link to CAPA for Grade 1 complaints\n• Received vs. Resolved trend on dashboard\n• Navigate: QMS → Complaints",
  },
  {
    patterns: [/change control|change request|\bccr\b|\bmoc\b/i],
    response: "**Change Control Module**\nManaged change per ICH Q10 §3.3:\n• Types: Equipment, Process, Method, Supplier, Software, Facility\n• 4-stage approval: Initiated → Under Review → Approved/Rejected → Implemented\n• Risk assessment and impact analysis required\n• Navigate: QMS → Change Control",
  },
  {
    patterns: [/supplier|vendor|qualification|approved.*supplier/i],
    response: "**Supplier Management**\nQualified supplier register:\n• Suppliers tracked: Divi's Laboratories (API), Hikal Ltd (API), Colorcon (HPMC), Uflex (foils), Schott AG (vials), BASF (excipients), Piramal Critical Care, Vimta Labs\n• Performance radar: Quality, Delivery, Cost, Responsiveness, Innovation, Compliance\n• Statuses: APPROVED / CONDITIONAL / PENDING / DISQUALIFIED\n• Navigate: QMS → Suppliers",
  },
  {
    patterns: [/\baudit\b|gmp audit|regulatory audit|inspection.*authority/i],
    response: "**Audit Management**\nInternal, external, and regulatory audits:\n• Types: Internal GMP, Regulatory, Supplier, Certification, Data Integrity\n• Authorities: CDSCO, EU GMP (EDQM), WHO Prequalification, ISO 9001\n• Findings tracked by: Major / Minor / OFI\n• Navigate: QMS → Audits",
  },
  {
    patterns: [/document|dms|\bsop\b|\bbmr\b|protocol|specification/i],
    response: "**Document Management System (DMS)**\nControlled document lifecycle:\n• Statuses: Draft → Under Review → Pending Approval → Approved → Published → Obsolete\n• Types: SOPs, BMRs, Specifications, Validation Protocols, Master Batch Records\n• 21 CFR Part 11 compliant e-signatures and audit trail\n• Navigate: DMS",
  },
  {
    patterns: [/inspection|incoming inspection|in.?process|final inspection/i],
    response: "**Inspection Management**\nProduct inspection records:\n• Types: Incoming (API/excipients), In-Process (compression, granulation), Final (batch release), Receiving (WFI, packaging)\n• Results: Pass / Fail / Conditional Pass / Pending\n• First-pass inspection rate tracked as KPI (target: 95%)\n• Navigate: Inspection",
  },
  {
    patterns: [/calibrat|equipment.*schedule|instrument.*calibrat/i],
    response: "**Calibration Management**\nEquipment calibration tracking:\n• Equipment: HPLC (Agilent 1260), Dissolution (Electrolab EDT-08), Analytical Balance (Mettler Toledo XPE205), Autoclave (Getinge HS6610), Particle Counter (Lighthouse SOLAIR 3100), Temperature Loggers\n• Statuses: Current / Due Soon / Overdue / Out of Service\n• Navigate: Calibration",
  },
  {
    patterns: [/training|\blms\b|learning|compliance.*training|gmp.*training/i],
    response: "**Learning Management System (LMS)**\nEmployee training & GMP compliance:\n• Course types: GMP, SOP, safety, technical, regulatory\n• Departmental compliance tracked (target: 90%)\n• QA leads at 98% compliance; Warehouse at 85%\n• Navigate: LMS → Training",
  },
  {
    patterns: [/dashboard|kpi|key.*indicator|overview.*data|summary.*stats/i],
    response: "**Dashboard KPIs** (pharma, 90-day view):\n• Open NCs: 33 | Open CAPAs: 18\n• Pending Approvals: 12 | Expiring Docs: 8\n• Training Compliance: 93%\n• Supplier Score: 86% | Audit Compliance: 91%\n• CAPA Closure Rate: 87% | First-Pass: 94.2%\nUse the 7D/30D/90D/1Y selector to adjust the date range.",
  },
  {
    patterns: [/\boos\b|out.of.spec|out.of.specification/i],
    response: "**OOS (Out-of-Specification) Handling**\nPer 21 CFR 211.192 and USP <1058>:\n• Phase I: Laboratory investigation (analyst error, instrument)\n• Phase II: Full production investigation\n• Log as NC with severity based on risk\n• Critical OOS → immediate CAPA initiation\n• OOS rate tracked as KPI on dashboard (current: 2.3%)",
  },
  {
    patterns: [/alcoa|data integrity|audit trail/i],
    response: "**ALCOA+ & Data Integrity**\nPlatform designed for ALCOA+ compliance:\n• **A**ttributable — all actions linked to user accounts\n• **L**egible — structured, human-readable records\n• **C**ontemporaneous — auto-timestamped at creation\n• **O**riginal — immutable audit trail\n• **A**ccurate — validated data entry\n• **+**: Complete, Consistent, Enduring, Available\nAudit log available at: QMS → Audit Log",
  },
  {
    patterns: [/schedule m|indian gmp|\bcdsco\b/i],
    response: "**Schedule M (Revised) — Indian GMP**\nEffective January 2024. Key requirements:\n• Premises and plant design with classified areas\n• Equipment qualification (DQ/IQ/OQ/PQ)\n• Documentation and batch record controls\n• Personnel training and hygiene\n• Product recall and self-inspection\nPlatform audit module includes CDSCO GMP Inspection checklist.",
  },
  {
    patterns: [/ich q10|pharmaceutical quality system|\bpqs\b/i],
    response: "**ICH Q10 — Pharmaceutical Quality System**\nPlatform implements all ICH Q10 elements:\n• §3.1 Process performance & product quality monitoring\n• §3.2 CAPA system → CAPA module\n• §3.3 Change management → Change Control module\n• §3.4 Management review → Dashboard KPIs\n• §3.5 Knowledge management → DMS",
  },
  {
    patterns: [/ich q8|quality by design|\bqbd\b|design space/i],
    response: "**ICH Q8 — Quality by Design**\nSupported through FMEA module:\n• Critical Quality Attributes (CQA) identification\n• Critical Process Parameters (CPP) in control plans\n• Design space documentation\n• Link FMEA records to process specifications in DMS",
  },
  {
    patterns: [/ich q9|quality risk/i],
    response: "**ICH Q9 — Quality Risk Management**\nSupported through Risk and FMEA modules:\n• Risk assessment tools: FMEA, HACCP, Risk ranking & filtering\n• Risk control and residual risk evaluation\n• Risk communication via risk register\n• RPN threshold alerts for high-risk items",
  },
  {
    patterns: [/batch|lot number|\brelease\b|batch record/i],
    response: "**Batch Management**\nBatch-linked quality records across modules:\n• NCs linked to specific batch numbers\n• Inspection records per batch/lot\n• BMR (Batch Manufacturing Records) controlled in DMS\n• Batch release on-time rate: 91% (current KPI)\n• Batch disposition recorded in inspection final results",
  },
  {
    patterns: [/eu gmp|annex 1|edqm|mhra/i],
    response: "**EU GMP Compliance**\nEU GMP Annex 1 (Manufacture of Sterile Medicinal Products):\n• Grade B aseptic fill facility for Ondansetron injection\n• Environmental monitoring and microbial limits\n• Media fill validation\nAudit module includes EU GMP Annex 1 checklist (EDQM inspection record present).",
  },
  {
    patterns: [/navigate|where.*find|how.*go|go to|which.*menu/i],
    response: "**Platform Navigation** (left sidebar):\n• **QMS** → NC, CAPA, FMEA, Risk, Change Control, Complaints, Suppliers, Audits\n• **DMS** → Documents, Folders\n• **Inspection** → Inspection Records\n• **Calibration** → Equipment Records\n• **LMS** → Training, Courses\n• **Analytics** → Dashboard, Scorecards\nUse keyboard shortcut ⌘K / Ctrl+K to open the command palette.",
  },
  {
    patterns: [/help|support|contact|report.*issue/i],
    response: "**Getting Help**\n• Ask me for module guidance or GMP questions\n• Contact your QA Administrator for user access issues\n• Report bugs to: info@forgequantumsolution.com\n• Platform: **Quantum Kaizen** by Forge Quantum Solutions",
  },
];

const DEFAULT = "I'm not sure about that. You can ask me about:\n• QMS modules (NC, CAPA, FMEA, Risk, Audits, Complaints)\n• DMS, Inspection, Calibration, LMS\n• GMP standards (Schedule M, ICH Q8/Q9/Q10, ALCOA+, EU GMP)\n• Dashboard KPIs and navigation";

function getResponse(query: string): string {
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(query))) return rule.response;
  }
  return DEFAULT;
}

function BotText({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split('\n').map((line, i) => {
        const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

const INIT: Message = {
  id: 'init',
  role: 'bot',
  text: "Hi! I'm QMS Assistant. Ask me anything about Quantum Kaizen — modules, GMP standards, navigation, or platform data.",
};

const SUGGESTIONS = ['What modules are available?', 'Explain CAPA workflow', 'ALCOA+ data integrity', 'OOS handling'];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INIT]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  function send(text = input.trim()) {
    if (!text) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: `b${Date.now()}`, role: 'bot', text: getResponse(text) }]);
      setTyping(false);
    }, 500);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close assistant' : 'Open QMS Assistant'}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          zIndex: 9999,
          width: '52px', height: '52px', borderRadius: '50%',
          background: open ? '#EF4444' : '#0D0E17',
          border: '2px solid #F59E0B',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform 150ms, background 150ms',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        {open ? <X size={18} color="#fff" /> : <MessageCircle size={21} color="#F59E0B" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: '88px', right: '24px',
            zIndex: 9999, width: '340px', height: '480px',
            borderRadius: '16px', border: '1px solid #E2E8F0',
            background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-surface-border shrink-0" style={{ backgroundColor: '#1A1A2E' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#C9A84C' }}>
              <Bot size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">QMS Assistant</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Quantum Kaizen Platform Guide</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {messages.map(msg => (
              <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div
                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: msg.role === 'bot' ? '#1A1A2E' : '#CBD5E1' }}
                >
                  {msg.role === 'bot'
                    ? <Bot size={12} className="text-white" />
                    : <User size={12} className="text-slate-600" />}
                </div>
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                    msg.role === 'bot'
                      ? 'bg-white border border-surface-border text-ink shadow-sm'
                      : 'text-white'
                  )}
                  style={msg.role === 'user' ? { backgroundColor: '#1A1A2E' } : {}}
                >
                  {msg.role === 'bot' ? <BotText text={msg.text} /> : <p className="text-xs">{msg.text}</p>}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1A1A2E' }}>
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-white border border-surface-border rounded-xl px-3 py-2.5 shadow-sm flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions (only on first message) */}
            {messages.length === 1 && !typing && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-surface-border bg-white shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about QMS, CAPA, GMP..."
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 placeholder:text-slate-400"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#1A1A2E' }}
            >
              <Send size={12} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
