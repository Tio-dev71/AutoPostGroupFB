import { prisma } from '../lib/prisma.js';

export interface PricingPlan {
  id: string;
  name: string;
  months: number;
  days: number;
  priceUsd: number;
  priceVnd: number;
  badge?: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  { id: '1month', name: '1 Tháng', months: 1, days: 30, priceUsd: 29, priceVnd: 725000 },
  { id: '2months', name: '2 Tháng', months: 2, days: 60, priceUsd: 49, priceVnd: 1225000, badge: 'Phổ biến' },
  { id: '3months', name: '3 Tháng', months: 3, days: 90, priceUsd: 69, priceVnd: 1725000, badge: 'Tiết kiệm nhất' },
];

export function getPlanById(planId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === planId);
}

export function generatePaymentCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AUTO${Date.now().toString().slice(-6)}${random}`;
}

export async function extendSubscription(userId: string, days: number) {
  const current = await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: 'inactive' },
    update: {},
  });

  const now = new Date();
  const base = current.endsAt && current.endsAt.getTime() > now.getTime() ? current.endsAt : now;
  const endsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.subscription.update({
    where: { userId },
    data: {
      status: 'active',
      startsAt: current.startsAt ?? now,
      endsAt,
    },
  });
}

export function buildVietQrUrl(params: { amount: number; code: string }) {
  const bankName = process.env.SEPAY_BANK_NAME || '';
  const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER || '';
  const accountHolder = process.env.SEPAY_ACCOUNT_HOLDER || '';
  const description = encodeURIComponent(params.code);
  const holder = encodeURIComponent(accountHolder);

  return `https://qr.sepay.vn/img?bank=${encodeURIComponent(bankName)}&acc=${encodeURIComponent(accountNumber)}&template=compact&amount=${params.amount}&des=${description}&accountName=${holder}`;
}
