import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ChatBot from '@/components/shared/ChatBot';

export default function AppLayout() {
  const { sidebarCollapsed } = useUIStore();
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar />

      <div
        className={cn(
          'transition-[margin-left] duration-250 ease-in-out flex flex-col min-h-screen',
          sidebarCollapsed ? 'ml-[56px]' : 'ml-[240px]'
        )}
      >
        <Header />
        <main className="flex-1 p-5 max-w-dashboard mx-auto w-full">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBot />
    </div>
  );
}
