import { useState } from 'react';
import { Modal, Tabs } from '@/components/ui';
import TimelineTab from './TimelineTab';
import ApprovalsTimeline from './ApprovalsTimeline';
import CommentsTab from './CommentsTab';
import DocsTab from './DocsTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  canUpdate: boolean;
  initialTab?: TabId;
}

type TabId = 'timeline' | 'approvals' | 'comments' | 'docs';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'comments', label: 'Comments' },
  { id: 'docs', label: 'Documents' },
];

export default function TicketActivityModal({
  isOpen,
  onClose,
  ticketId,
  canUpdate,
  initialTab = 'timeline',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activity" size="xl">
      <div>
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
        <div className="pt-3">
          {activeTab === 'timeline' && <TimelineTab ticketId={ticketId} />}
          {activeTab === 'approvals' && <ApprovalsTimeline ticketId={ticketId} />}
          {activeTab === 'comments' && <CommentsTab ticketId={ticketId} />}
          {activeTab === 'docs' && <DocsTab ticketId={ticketId} canUpdate={canUpdate} />}
        </div>
      </div>
    </Modal>
  );
}
