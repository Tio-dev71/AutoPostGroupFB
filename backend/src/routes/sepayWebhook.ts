import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { extendSubscription } from '../services/paymentService.js';

export const sepayWebhookRouter = Router();

sepayWebhookRouter.post('/sepay', async (req, res, next) => {
  try {
    const expectedToken = process.env.SEPAY_WEBHOOK_TOKEN;
    if (expectedToken && req.query.token !== expectedToken) {
      return res.status(401).json({ success: false, message: 'Invalid webhook token' });
    }

    const body = req.body ?? {};
    const transaction = await prisma.sePayTransaction.create({
      data: {
        gateway: body.gateway,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : null,
        accountNumber: body.accountNumber,
        subAccount: body.subAccount,
        transferType: body.transferType,
        transferAmount: Number(body.transferAmount || 0),
        accumulated: Number(body.accumulated || 0),
        code: body.code,
        content: body.content,
        referenceCode: body.referenceCode || null,
        description: body.description,
        rawBody: body,
      },
    });

    if (body.transferType !== 'in') {
      return res.json({ success: true, message: 'Ignored outgoing transaction' });
    }

    const searchable = [body.code, body.content, body.description].filter(Boolean).join(' ');
    const match = searchable.match(/AUTO[A-Z0-9]{8,}/i);
    if (!match) {
      return res.json({ success: true, message: 'No matching payment code' });
    }

    const code = match[0].toUpperCase();
    const order = await prisma.paymentOrder.findUnique({ where: { code } });
    if (!order || order.status !== 'pending') {
      return res.json({ success: true, message: 'Order not found or already processed' });
    }

    const transferAmount = Number(body.transferAmount || 0);
    if (transferAmount < order.amount) {
      return res.json({ success: true, message: 'Transfer amount is lower than order amount' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          rawMatchedTransactionId: transaction.id,
        },
      });
    });

    await extendSubscription(order.userId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.json({ success: true, message: 'Duplicate transaction ignored' });
    }
    next(err);
  }
});
