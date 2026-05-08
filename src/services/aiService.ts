// AI Content Rewriting Service
// Supports: OpenAI (GPT-4), Google Gemini, xAI Grok

import type { AIProvider } from '@/stores/useSettingsStore';

export interface AIRewriteOptions {
  content: string;
  tone: 'sales' | 'friendly' | 'professional' | 'viral';
  customPrompt?: string;
  provider: AIProvider;
  apiKey: string;
}

export interface AIRewriteResult {
  success: boolean;
  rewrittenContent?: string;
  error?: string;
}

const TONE_PROMPTS: Record<string, string> = {
  sales: 'Viết lại theo phong cách bán hàng mạnh, tạo sự khẩn cấp, kêu gọi hành động, thêm emoji phù hợp.',
  friendly: 'Viết lại theo phong cách thân thiện, gần gũi, dễ tiếp cận, như đang nói chuyện với bạn bè.',
  professional: 'Viết lại theo phong cách chuyên nghiệp, đáng tin cậy, rõ ràng, có cấu trúc tốt.',
  viral: 'Viết lại theo phong cách viral, gây tò mò, dùng hook mạnh, dễ chia sẻ, thu hút tương tác.',
};

function buildSystemPrompt(tone: string, customPrompt?: string): string {
  const base = `Bạn là chuyên gia viết content Facebook Marketing tại Việt Nam.
Nhiệm vụ: Viết lại bài đăng Facebook group cho hấp dẫn hơn.

Quy tắc:
- Giữ nguyên ý chính, thông tin sản phẩm/dịch vụ
- ${TONE_PROMPTS[tone] || TONE_PROMPTS.sales}
- Thêm emoji phù hợp nhưng không quá nhiều
- Giữ độ dài ±10% so với bài gốc
- Tối ưu cho Facebook group bán hàng Việt Nam
- Chỉ trả về nội dung viết lại, KHÔNG thêm giải thích`;

  if (customPrompt) {
    return `${base}\n\nYêu cầu thêm: ${customPrompt}`;
  }
  return base;
}

// ═══════════════════════════════════════════════════════════════════
// OpenAI
// ═══════════════════════════════════════════════════════════════════
async function rewriteWithOpenAI(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Viết lại bài đăng sau:\n\n${options.content}` },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices?.[0]?.message?.content?.trim();
    if (!rewrittenContent) throw new Error('Không nhận được phản hồi từ AI');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `OpenAI: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Google Gemini
// ═══════════════════════════════════════════════════════════════════
const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
] as const;

async function callGeminiRewriteModel(
  options: AIRewriteOptions,
  systemPrompt: string,
  model: string
): Promise<AIRewriteResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            parts: [{ text: `Viết lại bài đăng sau:\n\n${options.content}` }],
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rewrittenContent) throw new Error('Không nhận được phản hồi từ Gemini');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `${model}: ${err.message}` };
  }
}

async function rewriteWithGemini(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  const errors: string[] = [];

  for (const model of GEMINI_TEXT_MODELS) {
    const result = await callGeminiRewriteModel(options, systemPrompt, model);
    if (result.success) return result;
    if (result.error) errors.push(result.error);
  }

  return {
    success: false,
    error: `Gemini: Tất cả model fallback đều lỗi. ${errors.join(' | ')}`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// xAI Grok
// ═══════════════════════════════════════════════════════════════════
async function rewriteWithGrok(options: AIRewriteOptions): Promise<AIRewriteResult> {
  const systemPrompt = buildSystemPrompt(options.tone, options.customPrompt);
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Viết lại bài đăng sau:\n\n${options.content}` },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices?.[0]?.message?.content?.trim();
    if (!rewrittenContent) throw new Error('Không nhận được phản hồi từ Grok');

    return { success: true, rewrittenContent };
  } catch (err: any) {
    return { success: false, error: `Grok: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════
export async function rewriteContent(options: AIRewriteOptions): Promise<AIRewriteResult> {
  if (!options.apiKey) {
    return { success: false, error: 'Vui lòng nhập API Key trong Cài đặt' };
  }
  if (!options.content.trim()) {
    return { success: false, error: 'Nội dung trống' };
  }

  switch (options.provider) {
    case 'openai':
      return rewriteWithOpenAI(options);
    case 'gemini':
      return rewriteWithGemini(options);
    case 'grok':
      return rewriteWithGrok(options);
    default:
      return { success: false, error: `Provider không hỗ trợ: ${options.provider}` };
  }
}

// Batch rewrite for multiple groups (each with unique content)
export async function rewriteContentBatch(
  options: AIRewriteOptions,
  count: number
): Promise<AIRewriteResult[]> {
  const results: AIRewriteResult[] = [];
  for (let i = 0; i < count; i++) {
    const result = await rewriteContent({
      ...options,
      customPrompt: `${options.customPrompt || ''} (Phiên bản ${i + 1}/${count} — hãy viết khác các phiên bản trước)`.trim(),
    });
    results.push(result);
    // Small delay between API calls
    if (i < count - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

export type AIImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface AIImageOptions {
  prompt: string;
  provider: AIProvider;
  apiKey: string;
  size?: AIImageSize;
}

export interface AIImageResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
}

async function generateImageWithOpenAIModel(options: AIImageOptions, model: string): Promise<AIImageResult> {
  try {
    const body: Record<string, any> = {
      model,
      prompt: options.prompt,
      size: options.size || '1024x1024',
    };

    if (model === 'gpt-image-1') {
      body.quality = 'medium';
    } else if (model === 'dall-e-3') {
      body.quality = 'standard';
      body.n = 1;
    } else {
      body.n = 1;
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const item = data.data?.[0];
    if (item?.b64_json) {
      return { success: true, imageBase64: item.b64_json, mimeType: 'image/png' };
    }
    if (item?.url) {
      const imageResponse = await fetch(item.url);
      if (!imageResponse.ok) throw new Error(`Không tải được ảnh từ OpenAI URL: HTTP ${imageResponse.status}`);
      const blob = await imageResponse.blob();
      const imageBase64 = await blobToBase64(blob);
      return { success: true, imageBase64, mimeType: blob.type || 'image/png' };
    }

    throw new Error('Không nhận được dữ liệu ảnh từ OpenAI');
  } catch (err: any) {
    return { success: false, error: `${model}: ${err.message}` };
  }
}

async function generateImageWithOpenAI(options: AIImageOptions): Promise<AIImageResult> {
  const models = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];
  const errors: string[] = [];

  for (const model of models) {
    const result = await generateImageWithOpenAIModel(options, model);
    if (result.success) return result;
    if (result.error) errors.push(result.error);
  }

  return { success: false, error: `OpenAI Images: Tất cả model đều lỗi. ${errors.join(' | ')}` };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateImageWithGeminiContentModel(options: AIImageOptions, model: string): Promise<AIImageResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Tạo một hình ảnh chất lượng cao theo mô tả sau. Không chèn chữ/logo/watermark nếu không được yêu cầu.\n\n${options.prompt}`,
            }],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData?.data || part.inline_data?.data);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    const imageBase64 = inlineData?.data;
    if (!imageBase64) throw new Error('Không nhận được dữ liệu ảnh');

    return { success: true, imageBase64, mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png' };
  } catch (err: any) {
    return { success: false, error: `${model}: ${err.message}` };
  }
}

async function generateImageWithImagenModel(options: AIImageOptions, model: string): Promise<AIImageResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: options.prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: options.size === '1024x1536' ? '2:3' : options.size === '1536x1024' ? '3:2' : '1:1',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded || data.predictions?.[0]?.image?.bytesBase64Encoded;
    if (!imageBase64) throw new Error('Không nhận được dữ liệu ảnh Imagen');

    return { success: true, imageBase64, mimeType: 'image/png' };
  } catch (err: any) {
    return { success: false, error: `${model}: ${err.message}` };
  }
}

async function generateImageWithGemini(options: AIImageOptions): Promise<AIImageResult> {
  const errors: string[] = [];

  const geminiContentModels = [
    // Image-capable / preview names shown by Google AI Studio as Nano Banana variants
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-preview-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-2.0-flash-preview-image-generation',

    // Text/multimodal models from the user's quota list; if they return only text,
    // the code keeps trying the next model until one returns inline image data.
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];
  for (const model of geminiContentModels) {
    const result = await generateImageWithGeminiContentModel(options, model);
    if (result.success) return result;
    if (result.error) errors.push(result.error);
  }

  const imagenModels = [
    // Current Imagen IDs commonly exposed through Gemini API
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',

    // Preview/older IDs, kept as fallback for accounts where these are enabled
    'imagen-4.0-fast-generate-preview-06-06',
    'imagen-4.0-generate-preview-06-06',
    'imagen-4.0-ultra-generate-preview-06-06',
    'imagen-3.0-generate-002',
    'imagen-3.0-fast-generate-001',
  ];
  for (const model of imagenModels) {
    const result = await generateImageWithImagenModel(options, model);
    if (result.success) return result;
    if (result.error) errors.push(result.error);
  }

  return { success: false, error: `Gemini/Imagen Images: Tất cả model đều lỗi. ${errors.join(' | ')}` };
}

export async function generateImage(options: AIImageOptions): Promise<AIImageResult> {
  if (!options.apiKey) {
    return { success: false, error: 'Vui lòng nhập API Key trong Cài đặt' };
  }
  if (!options.prompt.trim()) {
    return { success: false, error: 'Prompt tạo ảnh đang trống' };
  }

  switch (options.provider) {
    case 'openai':
      return generateImageWithOpenAI(options);
    case 'gemini':
      return generateImageWithGemini(options);
    case 'grok':
      return { success: false, error: 'Tạo ảnh bằng Grok chưa được hỗ trợ trong bản này. Vui lòng chọn OpenAI hoặc Gemini.' };
    default:
      return { success: false, error: `Provider không hỗ trợ: ${options.provider}` };
  }
}
