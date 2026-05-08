import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Wand2, Copy, ImagePlus, X, Hash, Loader2, ArrowRight, FileImage, Palette, DownloadCloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { usePostStore, type ToneType, type ImageSize } from '@/stores/usePostStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateImage, rewriteContent } from '@/services/aiService';
import { toast } from 'sonner';

const imageSizes: { value: ImageSize; label: string }[] = [
  { value: '1024x1024', label: 'Vuông 1:1' },
  { value: '1024x1536', label: 'Dọc 2:3' },
  { value: '1536x1024', label: 'Ngang 3:2' },
];

const toneOptions: { value: ToneType; label: string; emoji: string }[] = [
  { value: 'sales', label: 'Bán hàng mạnh', emoji: '🔥' },
  { value: 'friendly', label: 'Thân thiện', emoji: '😊' },
  { value: 'professional', label: 'Chuyên nghiệp', emoji: '💼' },
  { value: 'viral', label: 'Viral', emoji: '🚀' },
];

export function AICompose() {
  const store = usePostStore();
  const hashtagInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiApiKey = useSettingsStore((s) => s.aiApiKey);

  const handleRewrite = async () => {
    if (!store.originalContent.trim()) { toast.error('Vui lòng nhập nội dung gốc'); return; }
    if (!aiApiKey) { toast.error('Vui lòng nhập API Key trong Cài đặt'); return; }

    store.setIsRewriting(true);
    const result = await rewriteContent({
      content: store.originalContent,
      tone: store.selectedTone,
      customPrompt: store.customPrompt,
      provider: aiProvider,
      apiKey: aiApiKey,
    });

    if (result.success && result.rewrittenContent) {
      const finalContent = store.hashtags.length > 0
        ? `${result.rewrittenContent}\n\n${store.hashtags.join(' ')}`
        : result.rewrittenContent;
      store.setAiRewrittenContent(finalContent);
      toast.success(`Đã viết lại bằng ${aiProvider.toUpperCase()}!`);
    } else {
      toast.error(result.error || 'Lỗi không xác định');
    }
    store.setIsRewriting(false);
  };

  const handleGenerateImage = async () => {
    if (!store.imageCaption.trim()) { toast.error('Vui lòng nhập nội dung đăng kèm'); return; }
    if (!store.imagePrompt.trim()) { toast.error('Vui lòng nhập prompt tạo ảnh'); return; }
    if (!aiApiKey) { toast.error('Vui lòng nhập API Key trong Cài đặt'); return; }

    store.setIsGeneratingImage(true);
    const result = await generateImage({
      prompt: store.imagePrompt,
      provider: aiProvider,
      apiKey: aiApiKey,
      size: store.imageSize,
    });

    if (result.success && result.imageBase64) {
      try {
        const path = await invoke<string>('save_generated_image', {
          base64Data: result.imageBase64,
          ext: 'png',
        });
        const preview = `data:${result.mimeType || 'image/png'};base64,${result.imageBase64}`;
        store.setGeneratedImage(path, preview);
        store.setAiRewrittenContent(store.imageCaption);
        toast.success('Đã tạo ảnh AI và thêm vào danh sách đăng!');
      } catch (err: any) {
        toast.error(`Không lưu được ảnh AI: ${err.message || err}`);
      }
    } else {
      toast.error(result.error || 'Không tạo được ảnh AI');
    }
    store.setIsGeneratingImage(false);
  };

  const handleUseImageCaption = () => {
    if (!store.imageCaption.trim()) { toast.error('Vui lòng nhập nội dung đăng kèm'); return; }
    store.setAiRewrittenContent(store.imageCaption);
    toast.success('Đã dùng nội dung đăng kèm cho Auto Post');
  };

  const handleCopy = () => { navigator.clipboard.writeText(store.aiRewrittenContent); toast.success('Đã copy!'); };

  const handleAddHashtag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = hashtagInputRef.current;
      if (input?.value.trim()) { store.addHashtag(input.value.trim()); input.value = ''; }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let added = 0;
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('video')) {
          toast.warning(`Video "${file.name}" chưa hỗ trợ lưu local tự động. Vui lòng dùng ảnh trước.`);
          continue;
        }

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        const base64Data = btoa(binary);
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const savedPath = await invoke<string>('save_generated_image', {
          base64Data,
          ext: ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'png',
        });
        const preview = URL.createObjectURL(file);

        store.addMedia({
          id: crypto.randomUUID(),
          name: file.name,
          path: savedPath,
          type: 'image',
          preview,
        });
        added += 1;
      } catch (err: any) {
        toast.error(`Không lưu được ảnh ${file.name}: ${err.message || err}`);
      }
    }

    if (added > 0) toast.success(`Đã thêm ${added} ảnh và lưu local để AutoPost upload`);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />Soạn bài viết AI
        </h2>
        <p className="text-sm text-muted-foreground">Sử dụng AI để viết lại nội dung hấp dẫn hơn</p>
      </div>

      {/* AI Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cấu hình AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tone giọng văn</Label>
            <div className="flex gap-2 flex-wrap">
              {toneOptions.map((t) => (
                <Button key={t.value} variant={store.selectedTone === t.value ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5" onClick={() => store.setSelectedTone(t.value)}>
                  <span>{t.emoji}</span>{t.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Prompt tùy chỉnh</Label>
            <Textarea value={store.customPrompt} onChange={(e) => store.setCustomPrompt(e.target.value)} rows={3} className="text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Split Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">📝 Nội dung gốc</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={store.originalContent} onChange={(e) => store.setOriginalContent(e.target.value)} placeholder="Nhập nội dung bài viết ở đây..." rows={10} className="text-sm" />
            <div className="mt-2 text-xs text-muted-foreground text-right">{store.originalContent.length} ký tự</div>
          </CardContent>
        </Card>
        <Card className="relative">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Nội dung AI viết lại</CardTitle></CardHeader>
          <CardContent>
            <div className="relative">
              <Textarea value={store.aiRewrittenContent} onChange={(e) => store.setAiRewrittenContent(e.target.value)} placeholder="Nội dung sẽ xuất hiện sau khi AI viết lại..." rows={10} className="text-sm" />
              {store.isRewriting && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                  <div className="flex flex-col items-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="text-xs text-muted-foreground">AI đang viết lại...</span></div>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{store.aiRewrittenContent.length} ký tự</span>
              {store.aiRewrittenContent && <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={handleCopy}><Copy className="w-3 h-3" />Copy</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" className="gap-3 px-8 h-12 text-sm font-semibold animate-pulse-glow" onClick={handleRewrite} disabled={store.isRewriting}>
          {store.isRewriting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
          Viết lại bằng AI<ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <Separator />

      {/* AI Image Generation */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Tạo ảnh AI + nội dung đăng kèm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nội dung đăng kèm ảnh</Label>
                <Textarea
                  value={store.imageCaption}
                  onChange={(e) => store.setImageCaption(e.target.value)}
                  placeholder="Nhập caption sẽ đăng cùng ảnh AI..."
                  rows={6}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Prompt tạo ảnh AI</Label>
                <Textarea
                  value={store.imagePrompt}
                  onChange={(e) => store.setImagePrompt(e.target.value)}
                  placeholder="Ví dụ: ảnh quảng cáo sản phẩm công nghệ, phong cách hiện đại, ánh sáng neon, chất lượng cao..."
                  rows={5}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {imageSizes.map((size) => (
                  <Button
                    key={size.value}
                    variant={store.imageSize === size.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => store.setImageSize(size.value)}
                    disabled={store.isGeneratingImage}
                  >
                    {size.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="gap-2" onClick={handleGenerateImage} disabled={store.isGeneratingImage}>
                  {store.isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                  Tạo ảnh bằng AI
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleUseImageCaption} disabled={store.isGeneratingImage}>
                  <DownloadCloud className="w-4 h-4" /> Dùng nội dung này
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tạo ảnh dùng API OpenAI/Gemini và sẽ tiêu tốn quota. Ảnh được lưu local để automation upload lên Facebook.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-primary/30 bg-background/70 min-h-[320px] flex items-center justify-center overflow-hidden">
              {store.isGeneratingImage ? (
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  AI đang render ảnh...
                </div>
              ) : store.generatedImagePreview ? (
                <div className="relative w-full h-full group">
                  <img src={store.generatedImagePreview} alt="Ảnh AI đã tạo" className="w-full h-full object-cover max-h-[420px]" />
                  <button
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => store.clearGeneratedImage()}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="text-center p-8">
                  <ImagePlus className="w-10 h-10 mx-auto text-primary/40" />
                  <p className="mt-3 text-sm font-medium">Ảnh AI sẽ hiển thị ở đây</p>
                  <p className="mt-1 text-xs text-muted-foreground">Nhập prompt rồi bấm “Tạo ảnh bằng AI”</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Media Upload */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileImage className="w-4 h-4 text-primary" />Ảnh / Video</CardTitle></CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
            <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">Kéo thả hoặc click để upload</p>
          </div>
          {store.media.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
              {store.media.map((item) => (
                <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                  <button className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => store.removeMedia(item.id)}><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hashtags */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Hash className="w-4 h-4 text-primary" />Hashtag</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input ref={hashtagInputRef} placeholder="Nhập hashtag và nhấn Enter..." className="text-xs h-9" onKeyDown={handleAddHashtag} />
          {store.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {store.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => store.removeHashtag(tag)}>{tag}<X className="w-3 h-3" /></Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
