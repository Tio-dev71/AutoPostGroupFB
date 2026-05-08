import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MonitorCog,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  FolderOpen,
  Info,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeAction } from '@/services/automationService';
import { toast } from 'sonner';

export function AccountConfig() {
  const chromePath = useSettingsStore((s) => s.chromePath);
  const setChromePath = useSettingsStore((s) => s.setChromePath);

  const [openingChrome, setOpeningChrome] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'unknown' | 'logged_in' | 'not_logged_in'>('unknown');

  const handleCheckSession = async (silent = false) => {
    setCheckingSession(true);
    try {
      const result = await executeAction('check_session', {
        chromePath: chromePath || undefined,
      });
      if (result.success) {
        setSessionStatus(result.isLoggedIn ? 'logged_in' : 'not_logged_in');
        if (!silent) {
          toast.success(result.isLoggedIn ? 'Đã đăng nhập Facebook!' : 'Chưa đăng nhập Facebook');
        }
      } else {
        setSessionStatus('unknown');
        if (!silent) toast.error(result.error || 'Không thể kiểm tra session');
      }
    } catch {
      setSessionStatus('unknown');
    }
    setCheckingSession(false);
  };

  const handleOpenChrome = async () => {
    setOpeningChrome(true);
    try {
      const result = await executeAction('open_chrome', {
        chromePath: chromePath || undefined,
      });
      if (result.success) {
        if (result.isLoggedIn) {
          setSessionStatus('logged_in');
          toast.success('Chrome đã mở — Facebook đã đăng nhập sẵn! ✅');
        } else {
          setSessionStatus('not_logged_in');
          toast.info('Chrome đã mở — hãy đăng nhập Facebook trong cửa sổ vừa mở');
        }
      } else {
        toast.error(result.error || 'Không thể mở Chrome');
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
    setOpeningChrome(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <MonitorCog className="w-5 h-5 text-primary" />
          Cấu hình Chrome Profile
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          App dùng Chrome persistent profile — bạn đăng nhập Facebook một lần, app sẽ nhớ mãi.
        </p>
      </div>

      {/* Session Status */}
      <Card className={
        sessionStatus === 'logged_in'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : sessionStatus === 'not_logged_in'
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border'
      }>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {sessionStatus === 'logged_in' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              {sessionStatus === 'not_logged_in' && <XCircle className="w-6 h-6 text-amber-500" />}
              {sessionStatus === 'unknown' && <AlertTriangle className="w-6 h-6 text-muted-foreground" />}
              <div>
                <p className="text-sm font-semibold">
                  {sessionStatus === 'logged_in' && 'Facebook đã đăng nhập ✅'}
                  {sessionStatus === 'not_logged_in' && 'Chưa đăng nhập Facebook'}
                  {sessionStatus === 'unknown' && 'Trạng thái chưa rõ'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sessionStatus === 'logged_in' && 'Sẵn sàng sử dụng auto post'}
                  {sessionStatus === 'not_logged_in' && 'Nhấn "Mở Chrome" để đăng nhập'}
                  {sessionStatus === 'unknown' && 'Nhấn kiểm tra để xem trạng thái'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => handleCheckSession(false)}
              disabled={checkingSession}
            >
              {checkingSession ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Kiểm tra
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Cách sử dụng
          </CardTitle>
          <CardDescription className="text-xs">
            Hướng dẫn thiết lập Chrome Profile lần đầu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              {
                step: '1',
                title: 'Mở Chrome',
                desc: 'Nhấn nút bên dưới để mở Chrome với profile riêng của app',
              },
              {
                step: '2',
                title: 'Đăng nhập Facebook',
                desc: 'Trong cửa sổ Chrome vừa mở, đăng nhập tài khoản Facebook của bạn như bình thường',
              },
              {
                step: '3',
                title: 'Đóng Chrome',
                desc: 'Sau khi đăng nhập xong, có thể đóng Chrome. Session sẽ được lưu lại',
              },
              {
                step: '4',
                title: 'Bắt đầu Auto Post',
                desc: 'Từ lần sau, app tự động dùng session đã lưu — không cần đăng nhập lại',
              },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Open Chrome Button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Mở Chrome
          </CardTitle>
          <CardDescription className="text-xs">
            Chrome sẽ mở với profile riêng lưu tại <code className="text-[11px] bg-muted px-1 rounded">~/.autopost/chrome-profile</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="lg"
            className="gap-3 w-full"
            onClick={handleOpenChrome}
            disabled={openingChrome}
          >
            {openingChrome ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <MonitorCog className="w-5 h-5" />
            )}
            {openingChrome ? 'Đang mở Chrome...' : 'Mở Chrome & Đăng nhập Facebook'}
          </Button>
          {sessionStatus === 'logged_in' && (
            <p className="text-xs text-emerald-500 text-center">
              ✅ Đã có session — bạn có thể bắt đầu auto post ngay!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Custom Chrome Path */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Chrome Path tùy chỉnh (không bắt buộc)
          </CardTitle>
          <CardDescription className="text-xs">
            Để trống nếu Chrome đặt ở vị trí mặc định. Chỉ cần điền nếu Chrome không tự tìm được.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={chromePath}
              onChange={(e) => setChromePath(e.target.value)}
              placeholder="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {chromePath && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setChromePath('')}
              >
                Xóa
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            macOS mặc định: <code>/Applications/Google Chrome.app/Contents/MacOS/Google Chrome</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
