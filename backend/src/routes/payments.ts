import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { buildVietQrUrl, generatePaymentCode, getMonthlyPrice } from '../services/paymentService.js';

export const paymentsRouter = Router();

paymentsRouter.post('/sepay/create', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const amount = getMonthlyPrice();
    const code = generatePaymentCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = await prisma.paymentOrder.create({
      data: {
        userId: req.user!.id,
        code,
        amount,
        expiresAt,
      },
    });

    return res.json({
      success: true,
      order,
      payment: {
        bankName: process.env.SEPAY_BANK_NAME || '',
        accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
        accountHolder: process.env.SEPAY_ACCOUNT_HOLDER || '',
        amount,
        transferCode: code,
        content: code,
        qrUrl: buildVietQrUrl({ amount, code }),
      },
    });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.paymentOrder.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn thanh toán' });

    return res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});
