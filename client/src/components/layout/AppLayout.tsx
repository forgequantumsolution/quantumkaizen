import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ScrollToTop from './ScrollToTop';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ChatBot from '@/components/shared/ChatBot';

export default function AppLayout() {
  const { sidebarCollapsed } = useUIStore();
  useKeyboardShortcuts();

  // PageContainer is now applied explicitly inside each page, so the layout
  // simply renders the outlet. Changing PageContainer's padding/margin
  // propagates to every page that uses it.
  return (
    <div className="min-h-screen bg-surface-bg">
      <ScrollToTop />
      <Sidebar />

      <div
        className={cn(
          'transition-[margin-left] duration-250 ease-in-out flex flex-col min-h-screen',
          sidebarCollapsed ? 'ml-[56px]' : 'ml-[288px]'
        )}
      >
        <Header />
        <main className="flex-1 w-full">
          <Outlet />
        </main>
      </div>
      <ChatBot />
    </div>
  );
}
