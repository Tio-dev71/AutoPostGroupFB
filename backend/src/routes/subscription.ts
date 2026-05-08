import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

export const subscriptionRouter = Router();

subscriptionRouter.get('/subscription/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await getOrCreateSubscription(req.user!.id);
    return res.json({ success: true, subscription: normalizeSubscription(subscription) });
  } catch (err) {
    next(err);
  }
});

const validateSchema = z.object({
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
});

subscriptionRouter.post('/license/validate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const body = validateSchema.parse(req.body ?? {});
    const subscription = await getOrCreateSubscription(req.user!.id);
    const normalized = normalizeSubscription(subscription);
    const active = normalized.status === 'active';

    if (active && body.deviceFingerprint) {
      await upsertDevice(req.user!.id, body.deviceFingerprint, body.deviceName);
    }

    return res.json({
      success: true,
      active,
      subscription: normalized,
      message: active ? 'License active' : 'Subscription inactive or expired',
    });
  } catch (err) {
    next(err);
  }
});

async function getOrCreateSubscription(userId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: 'inactive' },
    update: {},
  });
}

async function upsertDevice(userId: string, fingerprint: string, name?: string) {
  const limit = Number(process.env.APP_DEVICE_LIMIT || 1);
  const existing = await prisma.device.findUnique({ where: { userId_fingerprint: { userId, fingerprint } } });
  if (existing) {
    return prisma.device.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), name } });
  }

  const count = await prisma.device.count({ where: { userId } });
  if (count >= limit) {
    throw Object.assign(new Error(`Tài khoản đã đạt giới hạn ${limit} thiết bị`), { statusCode: 403 });
  }

  return prisma.device.create({ data: { userId, fingerprint, name } });
}

function normalizeSubscription(subscription: any) {
  if (subscription.endsAt && new Date(subscription.endsAt).getTime() < Date.now()) {
    return { ...subscription, status: 'expired' };
  }
  return subscription;
}
