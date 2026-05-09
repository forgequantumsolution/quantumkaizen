import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PageContainer from './PageContainer';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ChatBot from '@/components/shared/ChatBot';

// Routes that render their own full-bleed canvas (no PageContainer padding).
// Match exactly so we don't accidentally strip padding from siblings.
const FULL_BLEED_PATTERNS: RegExp[] = [/^\/workflows\/[^/]+\/builder\/?$/];

export default function AppLayout() {
  const { sidebarCollapsed } = useUIStore();
  const { pathname } = useLocation();
  useKeyboardShortcuts();

  const isFullBleed = FULL_BLEED_PATTERNS.some((p) => p.test(pathname));

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar />

      <div
        className={cn(
          'transition-[margin-left] duration-250 ease-in-out flex flex-col min-h-screen',
          sidebarCollapsed ? 'ml-[56px]' : 'ml-[256px]'
        )}
      >
        <Header />
        <main className="flex-1 w-full">
          {isFullBleed ? (
            <Outlet />
          ) : (
            <PageContainer>
              <Outlet />
            </PageContainer>
          )}
        </main>
      </div>
      <ChatBot />
    </div>
  );
}
