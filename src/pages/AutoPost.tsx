import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Rocket, Square, Play, Target, Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAutoPostStore } from '@/stores/useAutoPostStore';
import { useGroupStore } from '@/stores/useGroupStore';
import { useLogStore } from '@/stores/useLogStore';
import { usePostStore } from '@/stores/usePostStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeAction } from '@/services/automationService';
import { toast } from 'sonner';

export function AutoPost() {
  const status = useAutoPostStore((s) => s.status);
  const mode = useAutoPostStore((s) => s.mode);
  const groupsPerRun = useAutoPostStore((s) => s.groupsPerRun);
  const minDelay = useAutoPostStore((s) => s.minDelay);
  const maxDelay = useAutoPostStore((s) => s.maxDelay);
  const dailyLimit = useAutoPostStore((s) => s.dailyLimit);
  const postsToday = useAutoPostStore((s) => s.postsToday);
  const currentGroupIndex = useAutoPostStore((s) => s.currentGroupIndex);
  const totalGroups = useAutoPostStore((s) => s.totalGroups);
  const currentGroupName = useAutoPostStore((s) => s.currentGroupName);
  const results = useAutoPostStore((s) => s.results);
  const startSession = useAutoPostStore((s) => s.startSession);
  const updateProgress = useAutoPostStore((s) => s.updateProgress);
  const addResult = useAutoPostStore((s) => s.addResult);
  const setStatus = useAutoPostStore((s) => s.setStatus);
  const setMode = useAutoPostStore((s) => s.setMode);
  const setGroupsPerRun = useAutoPostStore((s) => s.setGroupsPerRun);
  const setMinDelay = useAutoPostStore((s) => s.setMinDelay);
  const setMaxDelay = useAutoPostStore((s) => s.setMaxDelay);
  const setDailyLimit = useAutoPostStore((s) => s.setDailyLimit);
  const stopSession = useAutoPostStore((s) => s.stopSession);
  const resetSession = useAutoPostStore((s) => s.resetSession);

  const groups = useGroupStore((s) => s.groups);
  const selectedGroups = useMemo(() => groups.filter((g) => g.isSelected), [groups]);
  const addLog = useLogStore((s) => s.addLog);
  const postContent = usePostStore((s) => s.aiRewrittenContent || s.imageCaption || s.originalContent);
  const media = usePostStore((s) => s.media);
  const mediaFiles = useMemo(
    () => media.map((m) => m.path).filter((path) => path && !path.startsWith('blob:')),
    [media]
  );
  const ignoredBlobMedia = useMemo(
    () => media.filter((m) => m.path?.startsWith('blob:')).length,
    [media]
  );
  const chromePath = useSettingsStore((s) => s.chromePath);
  const isRunning = status === 'running';

  const handleStart = async () => {
    if (selectedGroups.length === 0) { toast.error('Vui lòng chọn nhóm để đăng bài'); return; }
    if (!postContent.trim()) { toast.error('Vui lòng soạn nội dung bài viết trước'); return; }

    const total = groupsPerRun > 0 ? Math.min(groupsPerRun, selectedGroups.length) : selectedGroups.length;
    const groupsToPost = selectedGroups.slice(0, total);
    startSession(total);
    addLog('info', `Bắt đầu auto post cho ${total} nhóm`);
    addLog('info', `Media gửi sang automation: ${mediaFiles.length} file${mediaFiles.length ? ` — ${mediaFiles.join(', ')}` : ''}`);
    if (ignoredBlobMedia > 0) {
      addLog('warning', `Có ${ignoredBlobMedia} ảnh dạng blob preview bị bỏ qua vì không phải đường dẫn file local. Hãy dùng ảnh AI đã tạo/lưu local hoặc cần thêm chức năng chọn file native.`);
      toast.warning('Ảnh preview dạng blob không upload được. Hãy dùng ảnh AI đã lưu local.');
    }
    toast.success('Đã bắt đầu Auto Post!');

    try {
      await executeAction('auto_post', {
        groups: groupsToPost.map((g) => ({ id: g.id, name: g.name, url: g.url })),
        content: postContent,
        mediaFiles,
        minDelay,
        maxDelay,
        chromePath: chromePath || undefined,
        // profileDir omitted → automation/index.js uses ~/.autopost/chrome-profile automatically
      }, {
        onLog: (level, message) => addLog(level as any, message),
        onProgress: (index, _total, groupName) => updateProgress(index, groupName),
        onResult: (result) => addResult({ ...result, timestamp: result.timestamp || new Date().toISOString() }),
      });

      if (useAutoPostStore.getState().status === 'running') {
        setStatus('completed');
        addLog('success', 'Hoàn tất auto post!');
        toast.success('Auto Post hoàn tất!');
      }
    } catch (err: any) {
      setStatus('error');
      addLog('error', `Lỗi: ${err.message}`);
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  const handleStop = () => {
    stopSession();
    addLog('warning', 'Đã dừng auto post');
    toast.warning('Đã dừng Auto Post!');
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const progress = totalGroups > 0 ? Math.round((currentGroupIndex / totalGroups) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />Chạy Auto Post
        </h2>
        <p className="text-sm text-muted-foreground">
          Tự động đăng bài lên {selectedGroups.length} nhóm đã chọn
        </p>
      </div>

      <div className="flex items-center gap-4">
        {!isRunning ? (
          <Button size="lg" className="gap-3 px-10 h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse-glow" onClick={handleStart} disabled={status === 'completed'}>
            <Play className="w-6 h-6" />BẮT ĐẦU AUTO POST
          </Button>
        ) : (
          <Button size="lg" variant="destructive" className="gap-3 px-10 h-14 text-base font-bold" onClick={handleStop}>
            <Square className="w-6 h-6" />DỪNG KHẨN CẤP
          </Button>
        )}
        {status === 'completed' && (
          <Button variant="outline" size="lg" className="gap-2 h-14" onClick={() => resetSession()}>
            Đăng lại từ đầu
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Cài đặt đăng bài</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Số nhóm mỗi lần (0 = tất cả)</Label>
              <Input type="number" value={groupsPerRun} onChange={(e) => setGroupsPerRun(Number(e.target.value))} className="h-9 text-xs" disabled={isRunning} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Delay tối thiểu (phút)</Label>
                <Input type="number" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} className="h-9 text-xs" disabled={isRunning} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Delay tối đa (phút)</Label>
                <Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} className="h-9 text-xs" disabled={isRunning} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Giới hạn bài/ngày</Label>
              <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="h-9 text-xs" disabled={isRunning} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Chế độ</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'continue' | 'restart')} disabled={isRunning}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Tiếp tục từ lần trước</SelectItem>
                  <SelectItem value="restart">Bắt đầu lại từ đầu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Tiến trình</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tiến độ</span>
                <span className="font-medium">{currentGroupIndex} / {totalGroups}</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
            {currentGroupName && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <div>
                  <p className="text-xs font-medium">Đang xử lý</p>
                  <p className="text-[11px] text-muted-foreground">{currentGroupName}</p>
                </div>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-emerald-500/5">
                <p className="text-lg font-bold text-emerald-500">{successCount}</p>
                <p className="text-[10px] text-muted-foreground">Thành công</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/5">
                <p className="text-lg font-bold text-destructive">{failedCount}</p>
                <p className="text-[10px] text-muted-foreground">Thất bại</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-primary/5">
                <p className="text-lg font-bold text-primary">{postsToday}</p>
                <p className="text-[10px] text-muted-foreground">Hôm nay</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Daily Limit</span>
                <span>{postsToday} / {dailyLimit}</span>
              </div>
              <Progress value={(postsToday / dailyLimit) * 100} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">📋 Log realtime</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] rounded-lg bg-muted/30 p-3">
            <div className="space-y-1.5 log-terminal">
              {results.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-8">Chờ bắt đầu...</p>
              ) : (
                results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {r.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">[{new Date(r.timestamp).toLocaleTimeString('vi-VN')}]</span>
                    <span>{r.groupName}:</span>
                    <span className={r.status === 'success' ? 'text-emerald-500' : 'text-destructive'}>{r.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

