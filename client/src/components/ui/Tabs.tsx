import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div style={{ borderBottom: '1px solid #E8ECF2' }}>
      <nav className="flex gap-1 px-1 py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={isActive
                ? { backgroundColor: '#C9A84C', color: '#fff', borderRadius: '6px', padding: '6px 14px', border: 'none', cursor: 'pointer', transition: 'all 150ms' }
                : { backgroundColor: 'transparent', color: '#6B7280', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '6px 14px', transition: 'all 150ms' }
              }
              className={cn(
                'text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5',
                !isActive && 'hover:text-gray-900 hover:bg-gray-100',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={isActive
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, padding: '1px 6px' }
                    : { backgroundColor: '#F3F4F6', color: '#6B7280', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, padding: '1px 6px' }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
