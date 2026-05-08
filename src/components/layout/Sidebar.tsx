import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Home,
  MonitorCog,
  Users,
  Sparkles,
  Rocket,
  History,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Code2,
  Globe,
  Send,
  MessageCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type PageId =
  | 'dashboard'
  | 'accounts'
  | 'groups'
  | 'compose'
  | 'autopost'
  | 'history'
  | 'logs'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const navItems: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Trang chủ', icon: Home },
  { id: 'accounts', label: 'Chrome Profile', icon: MonitorCog },
  { id: 'groups', label: 'Nhóm', icon: Users },
  { id: 'compose', label: 'Soạn bài AI', icon: Sparkles },
  { id: 'autopost', label: 'Auto Post', icon: Rocket },
  { id: 'history', label: 'Lịch sử', icon: History },
  { id: 'logs', label: 'Log', icon: ScrollText },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen border-r border-border bg-sidebar transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[200px]'
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight gradient-text whitespace-nowrap">
              AutoPost AI
            </h1>
            <p className="text-[10px] text-muted-foreground">v1.0.0</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          const button = (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <Icon
                className={cn(
                  'w-[18px] h-[18px] shrink-0 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-accent-foreground'
                )}
              />
              {!collapsed && (
                <span className="animate-fade-in whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return button;
        })}
      </nav>

      {/* Branding Section */}
      <div className={cn("px-3 py-3 border-t border-border flex flex-col gap-2 transition-all", collapsed ? "items-center" : "")}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                <Code2 className="w-4 h-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs space-y-1 p-3">
              <p className="font-bold text-primary border-b border-border pb-1 mb-1">Dev by Tiodev</p>
              <p>Facebook: tiodev71</p>
              <p>Telegram: @tiodev71</p>
              <p>Zalo: 0977831621</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="bg-accent/40 rounded-xl p-3 text-xs space-y-2.5 border border-border/50 animate-fade-in overflow-hidden">
            <p className="font-semibold text-primary flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" /> Dev by Tiodev
            </p>
            <div className="space-y-2 text-muted-foreground text-[11px]">
              <a href="https://web.facebook.com/tiodev71" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Globe className="w-3 h-3" /> tiodev71
              </a>
              <a href="https://t.me/tiodev71" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Send className="w-3 h-3" /> @tiodev71
              </a>
              <a href="https://zalo.me/0977831621" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <MessageCircle className="w-3 h-3" /> 0977831621
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
