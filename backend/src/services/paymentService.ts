import { prisma } from '../lib/prisma.js';

export function getMonthlyPrice() {
  return Number(process.env.APP_MONTHLY_PRICE || 499000);
}

export function getSubscriptionDays() {
  return Number(process.env.APP_SUBSCRIPTION_DAYS || 30);
}

export function generatePaymentCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AUTO${Date.now().toString().slice(-6)}${random}`;
}

export async function extendSubscription(userId: string, days = getSubscriptionDays()) {
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
