import { useState, useEffect } from 'react';
import { Sidebar, type PageId } from './Sidebar';
import { Header } from './Header';
import { useThemeStore } from '@/stores/useThemeStore';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

// Pages
import { Dashboard } from '@/pages/Dashboard';
import { AccountConfig } from '@/pages/AccountConfig';
import { GroupList } from '@/pages/GroupList';
import { AICompose } from '@/pages/AICompose';
import { AutoPost } from '@/pages/AutoPost';
import { HistoryPage } from '@/pages/History';
import { ActivityLog } from '@/pages/ActivityLog';
import { SettingsPage } from '@/pages/Settings';

import { LoginPage } from '@/pages/Login';
import { useAuthStore } from '@/stores/useAuthStore';

const pages: Record<PageId, React.ComponentType> = {
  dashboard: Dashboard,
  accounts: AccountConfig,
  groups: GroupList,
  compose: AICompose,
  autopost: AutoPost,
  history: HistoryPage,
  logs: ActivityLog,
  settings: SettingsPage,
};

export function AppLayout() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const { isDark } = useThemeStore();
  const { isAuthenticated, hasActiveSubscription } = useAuthStore();

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  if (!isAuthenticated() || !hasActiveSubscription()) {
    return <LoginPage />;
  }

  const PageComponent = pages[currentPage];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header currentPage={currentPage} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="animate-fade-up">
              <PageComponent />
            </div>
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
