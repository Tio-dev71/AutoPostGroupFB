import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, signAccessToken, type AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email đã tồn tại' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        subscription: { create: { status: 'inactive' } },
      },
      include: { subscription: true },
    });

    const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
    return res.json({ success: true, token, user: sanitizeUser(user), subscription: user.subscription });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { subscription: true } });
    if (!user) return res.status(401).json({ success: false, error: 'Sai email hoặc mật khẩu' });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, error: 'Sai email hoặc mật khẩu' });

    const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
    return res.json({ success: true, token, user: sanitizeUser(user), subscription: normalizeSubscription(user.subscription) });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { subscription: true } });
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    return res.json({ success: true, user: sanitizeUser(user), subscription: normalizeSubscription(user.subscription) });
  } catch (err) {
    next(err);
  }
});

function sanitizeUser(user: { id: string; email: string; name: string; role: string; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}

function normalizeSubscription(subscription: any) {
  if (!subscription) return null;
  if (subscription.endsAt && new Date(subscription.endsAt).getTime() < Date.now()) {
    return { ...subscription, status: 'expired' };
  }
  return subscription;
}
