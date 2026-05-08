import { useGroupStore } from '@/stores/useGroupStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useLogStore } from '@/stores/useLogStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAutoPostStore } from '@/stores/useAutoPostStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Users,
  CalendarCheck,
  CheckCircle2,
  Activity,
  XCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';

export function Dashboard() {
  const groups = useGroupStore((s) => s.groups);
  const entries = useHistoryStore((s) => s.entries);
  const logs = useLogStore((s) => s.entries);
  const settings = useSettingsStore();
  const postsToday = useAutoPostStore((s) => s.postsToday);
  const dailyLimit = useAutoPostStore((s) => s.dailyLimit);

  // Real stats derived from stores
  const totalGroups = groups.length;
  const totalPosts = entries.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const postsTodayCount = entries.filter((e) => e.timestamp.startsWith(todayStr)).length || postsToday;
  const successEntries = entries.filter((e) => e.status === 'success');
  const successRate =
    entries.length > 0
      ? Math.round((successEntries.length / entries.length) * 100)
      : 0;

  // Recent activity from logs (latest 5)
  const recentLogs = [...logs].reverse().slice(0, 6);

  // Daily limit progress
  const dailyProgress = dailyLimit > 0 ? Math.round((postsTodayCount / dailyLimit) * 100) : 0;

  const stats = [
    {
      title: 'Tổng bài đã đăng',
      value: totalPosts.toString(),
      sub: totalPosts === 0 ? 'Chưa đăng bài nào' : `${successEntries.length} thành công`,
      icon: Send,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Nhóm đã thêm',
      value: totalGroups.toString(),
      sub: totalGroups === 0 ? 'Chưa có nhóm' : `${groups.filter((g) => g.isSelected).length} đang chọn`,
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Bài hôm nay',
      value: postsTodayCount.toString(),
      sub: dailyLimit > 0 ? `${dailyProgress}% daily limit` : 'Không giới hạn',
      icon: CalendarCheck,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      title: 'Tỷ lệ thành công',
      value: entries.length === 0 ? '—' : `${successRate}%`,
      sub: entries.length === 0 ? 'Chưa có dữ liệu' : `Trên ${entries.length} bài`,
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/10 p-6">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">
            AutoPost FB AI Pro 🚀
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            {totalGroups === 0 ? (
              <>Bắt đầu bằng cách thêm nhóm Facebook và mở Chrome để đăng nhập.</>
            ) : (
              <>
                Hệ thống sẵn sàng với{' '}
                <span className="text-primary font-medium">{totalGroups} nhóm</span> được
                cấu hình.{' '}
                {postsTodayCount > 0 && (
                  <span>Đã đăng <span className="text-emerald-400 font-medium">{postsTodayCount} bài</span> hôm nay.</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -right-5 -bottom-10 w-32 h-32 rounded-full bg-primary/10 blur-xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="group hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {stat.title}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {stat.sub}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.bg} transition-transform group-hover:scale-110`}
                  >
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity from real logs */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Hoạt động gần đây
            </CardTitle>
            <CardDescription className="text-xs">
              Log thực từ hệ thống auto post
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Chưa có hoạt động nào</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Bắt đầu auto post để xem log tại đây
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {log.level === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {log.level === 'error' && (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      {log.level === 'warning' && (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      {log.level === 'info' && (
                        <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <p className="text-xs">{log.message}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-3">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status — real data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Trạng thái hệ thống
            </CardTitle>
            <CardDescription className="text-xs">
              Cấu hình hiện tại
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Nhóm đã thêm</span>
                <Badge
                  variant="secondary"
                  className={`border-0 text-[10px] ${totalGroups > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}
                >
                  {totalGroups > 0 ? `${totalGroups} nhóm` : 'Chưa có'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AI Provider</span>
                <Badge
                  variant="secondary"
                  className="bg-violet-500/10 text-violet-500 border-0 text-[10px]"
                >
                  {settings.aiProvider === 'openai' ? 'OpenAI' : settings.aiProvider === 'gemini' ? 'Gemini' : 'Grok'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">API Key</span>
                <Badge
                  variant="secondary"
                  className={`border-0 text-[10px] ${settings.aiApiKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}
                >
                  {settings.aiApiKey ? 'Đã cấu hình' : 'Chưa có'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Proxy</span>
                <Badge
                  variant="secondary"
                  className={`border-0 text-[10px] ${settings.proxy.enabled ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}
                >
                  {settings.proxy.enabled ? 'Bật' : 'Tắt'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Giới hạn hôm nay</span>
                <span className="text-xs font-medium">{postsTodayCount} / {dailyLimit}</span>
              </div>
            </div>

            {/* Progress bar for daily limit */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Daily Limit</span>
                <span className="font-medium">{dailyProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                  style={{ width: `${dailyProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
