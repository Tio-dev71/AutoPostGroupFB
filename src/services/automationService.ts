// Automation Service — bridges frontend to Playwright via Rust IPC commands
import { useAuthStore } from '@/stores/useAuthStore';
import type { PostResult } from '@/stores/useAutoPostStore';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════
export interface IPCMessage {
  type: 'IPC_RESPONSE' | 'IPC_LOG' | 'IPC_PROGRESS' | 'IPC_RESULT';
  success?: boolean;
  error?: string;
  message?: string;
  level?: string;
  index?: number;
  total?: number;
  groupName?: string;
  groupId?: string;
  groupUrl?: string;
  status?: string;
  groups?: Array<{ id: string; name: string; url: string; memberCount: number }>;
  isLoggedIn?: boolean;
  [key: string]: any;
}

export type LogCallback = (level: string, message: string) => void;
export type ProgressCallback = (index: number, total: number, groupName: string) => void;
export type ResultCallback = (result: PostResult) => void;

// ═══════════════════════════════════════════════════════════════════
// Check if running inside Tauri
// ═══════════════════════════════════════════════════════════════════
function isTauri(): boolean {
  try {
    return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
}

function normalizeAutomationError(error: string): string {
  if (!error) return 'Lỗi không xác định';

  if (error.includes('ProcessSingleton') || error.includes('profile is already in use')) {
    return 'Chrome profile đang được mở hoặc bị khóa. Hãy đóng cửa sổ Chrome do app mở trước đó rồi thử lại. Nếu vẫn lỗi, chạy: pkill -f ".autopost/chrome-profile"';
  }

  if (error.includes('Không tìm thấy automation/index.js')) {
    return error;
  }

  if (error.includes('Executable doesn\'t exist') || error.includes('ENOENT')) {
    return 'Không tìm thấy Chrome. Vào Cài đặt hoặc Chrome Profile và kiểm tra lại Chrome Path.';
  }

  return error;
}

// ═══════════════════════════════════════════════════════════════════
// Execute automation action
// ═══════════════════════════════════════════════════════════════════
export async function executeAction(
  action: string,
  payload: Record<string, any> = {},
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  const publicActions = new Set(['test_connection']);
  const auth = useAuthStore.getState();
  if (!publicActions.has(action)) {
    if (!auth.isAuthenticated() || !auth.hasActiveSubscription()) {
      const error = 'Tài khoản chưa có gói thuê tháng active. Vui lòng đăng nhập và thanh toán/gia hạn để sử dụng automation.';
      callbacks?.onLog?.('error', error);
      return { type: 'IPC_RESPONSE', success: false, error };
    }

    const active = await auth.validateLicense().catch(() => false);
    if (!active) {
      const error = 'Backend báo license không còn active. Vui lòng gia hạn trước khi chạy automation.';
      callbacks?.onLog?.('error', error);
      return { type: 'IPC_RESPONSE', success: false, error };
    }
  }

  if (isTauri()) {
    return executeTauriAction(action, payload, callbacks);
  }
  // Fallback for browser dev mode only
  return executeSimulatedAction(action, payload, callbacks);
}

// ═══════════════════════════════════════════════════════════════════
// Check dependencies (node, playwright)
// ═══════════════════════════════════════════════════════════════════
export async function checkDependencies(): Promise<{ node: string; hasDeps: boolean }> {
  if (!isTauri()) {
    return { node: 'simulated', hasDeps: true };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<string>('check_dependencies');
  return JSON.parse(result);
}

// ═══════════════════════════════════════════════════════════════════
// Install automation dependencies
// ═══════════════════════════════════════════════════════════════════
export async function installDependencies(): Promise<string> {
  if (!isTauri()) return 'Simulated';
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('install_automation_deps');
}

// ═══════════════════════════════════════════════════════════════════
// Tauri IPC execution via Rust commands
// ═══════════════════════════════════════════════════════════════════
async function executeTauriAction(
  action: string,
  payload: Record<string, any>,
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  const { invoke } = await import('@tauri-apps/api/core');

  callbacks?.onLog?.('info', `Đang thực hiện: ${action}...`);

  try {
    const payloadStr = JSON.stringify(payload);
    const rawOutput = await invoke<string>('run_automation', {
      action,
      payload: payloadStr,
    });

    // Parse multi-line JSON output from Node.js
    const lines = rawOutput.split('\n').filter((l) => l.trim());
    let lastResponse: IPCMessage = { type: 'IPC_RESPONSE', success: false, error: 'No response' };

    for (const line of lines) {
      try {
        const msg: IPCMessage = JSON.parse(line.trim());
        switch (msg.type) {
          case 'IPC_LOG':
            callbacks?.onLog?.(msg.level || 'info', msg.message || '');
            break;
          case 'IPC_PROGRESS':
            callbacks?.onProgress?.(msg.index || 0, msg.total || 0, msg.groupName || '');
            break;
          case 'IPC_RESULT':
            callbacks?.onResult?.({
              groupId: msg.groupId || '',
              groupName: msg.groupName || '',
              groupUrl: msg.groupUrl || '',
              status: (msg.status as 'success' | 'failed' | 'skipped') || 'failed',
              message: msg.message,
              timestamp: new Date().toISOString(),
            });
            break;
          case 'IPC_RESPONSE':
            lastResponse = {
              ...msg,
              error: msg.error ? normalizeAutomationError(msg.error) : msg.error,
            };
            break;
        }
      } catch {
        // Non-JSON line, ignore
      }
    }

    return lastResponse;
  } catch (err: any) {
    const normalized = normalizeAutomationError(err.toString());
    callbacks?.onLog?.('error', `Lỗi: ${normalized}`);
    return { type: 'IPC_RESPONSE', success: false, error: normalized };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Simulated execution (for browser dev mode without Tauri)
// ═══════════════════════════════════════════════════════════════════
async function executeSimulatedAction(
  action: string,
  payload: Record<string, any>,
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  callbacks?.onLog?.('info', `[DEV] Action: ${action}`);
  await new Promise((r) => setTimeout(r, 800));

  switch (action) {
    case 'test_connection':
      callbacks?.onLog?.('success', 'Playwright sẵn sàng (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, message: 'Connection OK (dev mode)' };

    case 'open_chrome':
      callbacks?.onLog?.('success', 'Chrome đã mở (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, isLoggedIn: false, message: 'Chrome opened (dev mode)' };

    case 'check_session':
      callbacks?.onLog?.('info', 'Kiểm tra session (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, isLoggedIn: false, message: 'Not logged in (dev mode)' };

    case 'scan_groups':
      callbacks?.onLog?.('info', 'Đang quét nhóm...');
      await new Promise((r) => setTimeout(r, 2000));
      return { type: 'IPC_RESPONSE', success: false, error: 'Cần chạy trong Tauri app để quét nhóm thực' };

    case 'auto_post': {
      const groups = payload.groups || [];
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        callbacks?.onProgress?.(i + 1, groups.length, g.name);
        callbacks?.onLog?.('info', `[${i + 1}/${groups.length}] Đang đăng: ${g.name}`);
        await new Promise((r) => setTimeout(r, 1500));
        callbacks?.onResult?.({
          groupId: g.id, groupName: g.name, groupUrl: g.url,
          status: 'failed',
          message: 'Cần chạy trong Tauri app',
          timestamp: new Date().toISOString(),
        });
        callbacks?.onLog?.('error', `${g.name}: Cần Tauri để chạy thực`);
      }
      return { type: 'IPC_RESPONSE', success: false, error: 'Chạy trong Tauri app để sử dụng auto post thực' };
    }

    default:
      return { type: 'IPC_RESPONSE', success: false, error: `Unknown action: ${action}` };
  }
}
