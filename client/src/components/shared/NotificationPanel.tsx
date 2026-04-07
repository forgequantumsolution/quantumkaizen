import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  X,
  CheckCheck,
} from 'lucide-react';
import { useNotificationStore, AppNotification } from '@/stores/notificationStore';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'unread' | 'approvals' | 'tasks';

const typeConfig: Record<
  AppNotification['type'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  SYSTEM: {
    icon: Bell,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  APPROVAL_REQUEST: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  OVERDUE: {
    icon: Clock,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  EXPIRING: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  TASK_ASSIGNED: {
    icon: User,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'tasks', label: 'Tasks' },
];

export default function NotificationPanel() {
  const navigate = useNavigate();
  const { notifications, markRead, markAllRead, closePanel } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'approvals') return n.type === 'APPROVAL_REQUEST';
    if (activeTab === 'tasks') return n.type === 'TASK_ASSIGNED';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleItemClick(n: AppNotification) {
    markRead(n.id);
    if (n.link) {
      navigate(n.link);
    }
    closePanel();
  }

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/20"
          onClick={closePanel}
        />

        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed top-0 right-0 h-full w-96 z-50 bg-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600/15 text-[11px] font-semibold text-slate-900">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-slate-900 hover:bg-gray-100 rounded-lg transition-colors duration-175"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={closePanel}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-175"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 shrink-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-175',
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto py-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Bell size={22} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400">
                  {activeTab === 'all'
                    ? "You're all caught up."
                    : `No ${activeTab} notifications.`}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-border/60">
                {filtered.map((n) => {
                  const cfg = typeConfig[n.type];
                  const Icon = cfg.icon;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleItemClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3.5 px-5 py-3.5 text-left transition-colors duration-150',
                          n.isRead
                            ? 'hover:bg-gray-50'
                            : 'bg-blue-600/[0.04] hover:bg-blue-600/[0.08]'
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
                            cfg.bg
                          )}
                        >
                          <Icon size={15} className={cfg.color} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm leading-snug truncate',
                              n.isRead
                                ? 'font-normal text-gray-700'
                                : 'font-semibold text-gray-900'
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!n.isRead && (
                          <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
