import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Key, Globe, Globe2, Clock, Download, Upload, Bell, Volume2, Info } from 'lucide-react';
import { useSettingsStore, type AIProvider } from '@/stores/useSettingsStore';
import { toast } from 'sonner';

export function SettingsPage() {
  const settings = useSettingsStore();

  const handleExport = () => {
    const json = settings.exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'autopost_config.json';
    a.click(); URL.revokeObjectURL(url);
    toast.success('Đã export cấu hình!');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        settings.importConfig(ev.target?.result as string);
        toast.success('Đã import cấu hình!');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />Cài đặt
        </h2>
        <p className="text-sm text-muted-foreground">Cấu hình ứng dụng AutoPost FB AI Pro</p>
      </div>

      {/* AI Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4 text-primary" />AI API</CardTitle>
          <CardDescription className="text-xs">Cấu hình API key cho AI viết lại nội dung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">AI Provider</Label>
            <Select value={settings.aiProvider} onValueChange={(v) => settings.setAiProvider(v as AIProvider)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="grok">xAI Grok</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">API Key</Label>
            <Input type="password" value={settings.aiApiKey} onChange={(e) => settings.setAiApiKey(e.target.value)} placeholder="sk-..." className="h-9 text-xs font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* Browser Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Globe2 className="w-4 h-4 text-primary" />Trình duyệt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Chrome Path</Label>
            <Input value={settings.chromePath} onChange={(e) => settings.setChromePath(e.target.value)} placeholder="/Applications/Google Chrome.app" className="h-9 text-xs font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* Proxy Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />Proxy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Bật Proxy</Label>
            <Switch checked={settings.proxy.enabled} onCheckedChange={(v) => settings.setProxy({ enabled: v })} />
          </div>
          {settings.proxy.enabled && (
            <div className="space-y-3 animate-fade-up">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Host</Label>
                  <Input value={settings.proxy.host} onChange={(e) => settings.setProxy({ host: e.target.value })} placeholder="proxy.example.com" className="h-9 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Port</Label>
                  <Input value={settings.proxy.port} onChange={(e) => settings.setProxy({ port: e.target.value })} placeholder="8080" className="h-9 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Username</Label>
                  <Input value={settings.proxy.username} onChange={(e) => settings.setProxy({ username: e.target.value })} className="h-9 text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Password</Label>
                  <Input type="password" value={settings.proxy.password} onChange={(e) => settings.setProxy({ password: e.target.value })} className="h-9 text-xs" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Mặc định</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Delay min (phút)</Label>
              <Input type="number" value={settings.defaultMinDelay} onChange={(e) => settings.setDefaultMinDelay(Number(e.target.value))} className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Delay max (phút)</Label>
              <Input type="number" value={settings.defaultMaxDelay} onChange={(e) => settings.setDefaultMaxDelay(Number(e.target.value))} className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Giới hạn/ngày</Label>
              <Input type="number" value={settings.defaultDailyLimit} onChange={(e) => settings.setDefaultDailyLimit(Number(e.target.value))} className="h-9 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Thông báo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-muted-foreground" /><Label className="text-xs">Thông báo</Label></div>
            <Switch checked={settings.enableNotifications} onCheckedChange={() => settings.toggleNotifications()} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Volume2 className="w-3.5 h-3.5 text-muted-foreground" /><Label className="text-xs">Âm thanh</Label></div>
            <Switch checked={settings.enableSound} onCheckedChange={() => settings.toggleSound()} />
          </div>
        </CardContent>
      </Card>

      {/* Export/Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Export / Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleExport}><Download className="w-3.5 h-3.5" />Export Config</Button>
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleImport}><Upload className="w-3.5 h-3.5" />Import Config</Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium">AutoPost FB AI Pro v1.0.0</p>
              <p className="text-[11px] text-muted-foreground">Phần mềm đăng bài Facebook tự động thông minh</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
