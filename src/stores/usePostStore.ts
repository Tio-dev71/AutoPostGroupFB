// Store for post composition and AI rewriting
import { create } from 'zustand';

export type ToneType = 'sales' | 'friendly' | 'professional' | 'viral';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface PostMedia {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video';
  preview?: string;
}

interface PostState {
  originalContent: string;
  aiRewrittenContent: string;
  selectedTone: ToneType;
  customPrompt: string;
  isRewriting: boolean;
  media: PostMedia[];
  hashtags: string[];
  imageCaption: string;
  imagePrompt: string;
  imageSize: ImageSize;
  generatedImagePath: string;
  generatedImagePreview: string;
  isGeneratingImage: boolean;
  
  setOriginalContent: (content: string) => void;
  setAiRewrittenContent: (content: string) => void;
  setSelectedTone: (tone: ToneType) => void;
  setCustomPrompt: (prompt: string) => void;
  setIsRewriting: (loading: boolean) => void;
  addMedia: (media: PostMedia) => void;
  removeMedia: (id: string) => void;
  clearMedia: () => void;
  addHashtag: (tag: string) => void;
  removeHashtag: (tag: string) => void;
  setImageCaption: (content: string) => void;
  setImagePrompt: (prompt: string) => void;
  setImageSize: (size: ImageSize) => void;
  setGeneratedImage: (path: string, preview: string) => void;
  setIsGeneratingImage: (loading: boolean) => void;
  clearGeneratedImage: () => void;
  clearAll: () => void;
}

const DEFAULT_PROMPT = `Viết lại nội dung sau đây hấp dẫn hơn, thuyết phục hơn, tự nhiên như người thật, thêm emoji phù hợp, giữ độ dài ±10%, tối ưu cho Facebook group mua bán.`;

export const usePostStore = create<PostState>()((set) => ({
  originalContent: '',
  aiRewrittenContent: '',
  selectedTone: 'friendly',
  customPrompt: DEFAULT_PROMPT,
  isRewriting: false,
  media: [],
  hashtags: [],
  imageCaption: '',
  imagePrompt: '',
  imageSize: '1024x1024',
  generatedImagePath: '',
  generatedImagePreview: '',
  isGeneratingImage: false,

  setOriginalContent: (content) => set({ originalContent: content }),
  setAiRewrittenContent: (content) => set({ aiRewrittenContent: content }),
  setSelectedTone: (tone) => set({ selectedTone: tone }),
  setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
  setIsRewriting: (loading) => set({ isRewriting: loading }),

  addMedia: (media) =>
    set((state) => ({ media: [...state.media, media] })),

  removeMedia: (id) =>
    set((state) => ({ media: state.media.filter((m) => m.id !== id) })),

  clearMedia: () => set({ media: [] }),

  addHashtag: (tag) =>
    set((state) => {
      const cleaned = tag.startsWith('#') ? tag : `#${tag}`;
      if (state.hashtags.includes(cleaned)) return state;
      return { hashtags: [...state.hashtags, cleaned] };
    }),

  removeHashtag: (tag) =>
    set((state) => ({ hashtags: state.hashtags.filter((h) => h !== tag) })),

  setImageCaption: (content) => set({ imageCaption: content }),
  setImagePrompt: (prompt) => set({ imagePrompt: prompt }),
  setImageSize: (size) => set({ imageSize: size }),
  setGeneratedImage: (path, preview) =>
    set((state) => {
      const media: PostMedia = {
        id: crypto.randomUUID(),
        name: path.split(/[\\/]/).pop() || 'ai-generated-image.png',
        path,
        type: 'image',
        preview,
      };
      return {
        generatedImagePath: path,
        generatedImagePreview: preview,
        media: [...state.media.filter((m) => m.id !== 'ai-generated-image'), { ...media, id: 'ai-generated-image' }],
      };
    }),
  setIsGeneratingImage: (loading) => set({ isGeneratingImage: loading }),
  clearGeneratedImage: () =>
    set((state) => ({
      generatedImagePath: '',
      generatedImagePreview: '',
      media: state.media.filter((m) => m.id !== 'ai-generated-image'),
    })),

  clearAll: () =>
    set({
      originalContent: '',
      aiRewrittenContent: '',
      media: [],
      hashtags: [],
      imageCaption: '',
      imagePrompt: '',
      generatedImagePath: '',
      generatedImagePreview: '',
      isGeneratingImage: false,
    }),
}));
