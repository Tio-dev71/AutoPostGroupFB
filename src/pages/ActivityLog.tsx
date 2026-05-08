import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Download, Trash2, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useLogStore, type LogLevel } from '@/stores/useLogStore';
import { toast } from 'sonner';

const levelIcons: Record<LogLevel, React.ReactNode> = {
  info: <Info className="w-3.5 h-3.5 text-blue-400" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

const levelColors: Record<LogLevel, string> = {
  info: 'log-info',
  success: 'log-success',
  warning: 'log-warning',
  error: 'log-error',
};

export function ActivityLog() {
  const { entries, clearLogs } = useLogStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length]);

  const handleExport = () => {
    if (entries.length === 0) {
      toast.info('Không có log để export');
      return;
    }
    const text = entries
      .map((e) => `[${new Date(e.timestamp).toLocaleString('vi-VN')}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã export log!');
  };

  const handleClear = () => {
    clearLogs();
    toast.info('Đã xóa log');
  };

  const infoCount = entries.filter((l) => l.level === 'info').length;
  const successCount = entries.filter((l) => l.level === 'success').length;
  const warningCount = entries.filter((l) => l.level === 'warning').length;
  const errorCount = entries.filter((l) => l.level === 'error').length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />Activity Log
          </h2>
          <p className="text-sm text-muted-foreground">{entries.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />Export .txt
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-xs text-destructive" onClick={handleClear}>
            <Trash2 className="w-3.5 h-3.5" />Clear
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-0 text-xs gap-1"><Info className="w-3 h-3" />{infoCount} Info</Badge>
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />{successCount} Success</Badge>
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 text-xs gap-1"><AlertTriangle className="w-3 h-3" />{warningCount} Warning</Badge>
        <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs gap-1"><XCircle className="w-3 h-3" />{errorCount} Error</Badge>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-[500px] overflow-y-auto bg-[oklch(0.1_0.01_260)] p-4">
            {entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <ScrollText className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-sm text-white/50 font-medium">Chưa có log nào</p>
                <p className="text-xs text-white/30 mt-1">Khi chạy auto post, log thật sẽ hiển thị tại đây</p>
              </div>
            ) : (
              <div className="space-y-1 log-terminal">
                {entries.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-0.5 hover:bg-white/5 px-2 rounded">
                    <span className="shrink-0 mt-0.5">{levelIcons[log.level]}</span>
                    <span className="text-white/40 shrink-0">[{new Date(log.timestamp).toLocaleTimeString('vi-VN')}]</span>
                    <span className={levelColors[log.level]}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
