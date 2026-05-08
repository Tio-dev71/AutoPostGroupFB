import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { paymentsRouter } from './routes/payments.js';
import { sepayWebhookRouter } from './routes/sepayWebhook.js';
import { subscriptionRouter } from './routes/subscription.js';

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'autopost-license-backend', time: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/payments', paymentsRouter);
app.use('/webhooks', sepayWebhookRouter);
app.use('/', subscriptionRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ', details: err.flatten() });
  }

  const status = err.statusCode || 500;
  return res.status(status).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`AutoPost license backend listening on :${port}`);
});
