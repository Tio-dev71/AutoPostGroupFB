import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from '@/services/apiClient';

export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'canceled';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface SubscriptionInfo {
  id: string;
  status: SubscriptionStatus;
  plan: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface AuthApiResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  subscription: SubscriptionInfo | null;
}

interface SubscriptionApiResponse {
  success: boolean;
  subscription: SubscriptionInfo | null;
  active?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
  validateLicense: () => Promise<boolean>;
  isAuthenticated: () => boolean;
  hasActiveSubscription: () => boolean;
}

function applySubscription(subscription: SubscriptionInfo | null) {
  if (!subscription) {
    return { subscriptionStatus: 'inactive' as SubscriptionStatus, subscriptionEndsAt: null };
  }

  const expired = subscription.endsAt && new Date(subscription.endsAt).getTime() <= Date.now();
  return {
    subscriptionStatus: expired ? 'expired' as SubscriptionStatus : subscription.status,
    subscriptionEndsAt: subscription.endsAt ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      subscriptionStatus: 'inactive',
      subscriptionEndsAt: null,

      login: async (email: string, password: string) => {
        if (!email.trim() || !password.trim()) {
          throw new Error('Vui lòng nhập email và mật khẩu');
        }

        const data = await apiRequest<AuthApiResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        set({
          user: data.user,
          token: data.token,
          ...applySubscription(data.subscription),
        });
      },

      register: async (name: string, email: string, password: string) => {
        if (!name.trim() || !email.trim() || password.length < 6) {
          throw new Error('Vui lòng nhập đủ thông tin, mật khẩu tối thiểu 6 ký tự');
        }

        const data = await apiRequest<AuthApiResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });

        set({
          user: data.user,
          token: data.token,
          ...applySubscription(data.subscription),
        });
      },

      logout: () => {
        set({ user: null, token: null, subscriptionStatus: 'inactive', subscriptionEndsAt: null });
      },

      refreshSubscription: async () => {
        const token = get().token;
        if (!token) return;

        const data = await apiRequest<SubscriptionApiResponse>('/subscription/me', { method: 'GET' }, token);
        set(applySubscription(data.subscription));
      },

      validateLicense: async () => {
        const token = get().token;
        if (!token) return false;

        const data = await apiRequest<SubscriptionApiResponse>('/license/validate', {
          method: 'POST',
          body: JSON.stringify({ deviceName: navigator.userAgent }),
        }, token);

        set(applySubscription(data.subscription));
        return Boolean(data.active);
      },

      isAuthenticated: () => Boolean(get().user && get().token),

      hasActiveSubscription: () => {
        const { subscriptionStatus, subscriptionEndsAt } = get();
        if (subscriptionStatus !== 'active') return false;
        if (!subscriptionEndsAt) return true;
        return new Date(subscriptionEndsAt).getTime() > Date.now();
      },
    }),
    { name: 'autopost-auth' }
  )
);
