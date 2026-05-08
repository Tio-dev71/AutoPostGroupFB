import { apiRequest } from '@/services/apiClient';
import { useAuthStore } from '@/stores/useAuthStore';

export interface PricingPlan {
  id: string;
  name: string;
  months: number;
  days: number;
  priceUsd: number;
  priceVnd: number;
  badge?: string;
}

export interface SePayOrder {
  id: string;
  code: string;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'canceled';
  expiresAt: string;
}

export interface SePayPaymentInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  transferCode: string;
  content: string;
  qrUrl: string;
}

export async function createSePayOrder(planId: string) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Bạn cần đăng nhập trước khi tạo thanh toán');

  return apiRequest<{ success: boolean; order: SePayOrder; plan: PricingPlan; payment: SePayPaymentInfo }>(
    '/payments/sepay/create',
    { method: 'POST', body: JSON.stringify({ planId }) },
    token
  );
}

export async function getPaymentOrder(orderId: string) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Bạn cần đăng nhập trước khi kiểm tra thanh toán');

  return apiRequest<{ success: boolean; order: SePayOrder }>(`/payments/${orderId}`, { method: 'GET' }, token);
}
