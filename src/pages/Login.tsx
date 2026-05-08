import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarClock, Copy, LockKeyhole, QrCode, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { createSePayOrder, getPaymentOrder, type SePayOrder, type SePayPaymentInfo } from '@/services/paymentService';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<SePayOrder | null>(null);
  const [payment, setPayment] = useState<SePayPaymentInfo | null>(null);
  const [polling, setPolling] = useState(false);
  const { login, register, user, hasActiveSubscription, logout, subscriptionEndsAt, refreshSubscription } = useAuthStore();

  const active = hasActiveSubscription();

  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const timer = window.setInterval(async () => {
      try {
        setPolling(true);
        const result = await getPaymentOrder(order.id);
        setOrder(result.order);
        if (result.order.status === 'paid') {
          await refreshSubscription();
          window.clearInterval(timer);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không kiểm tra được thanh toán');
      } finally {
        setPolling(false);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [order, refreshSubscription]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await createSePayOrder();
      setOrder(result.order);
      setPayment(result.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được đơn thanh toán SePay');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  if (user && !active) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#05070f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.28),transparent_34%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
          <section className="grid w-full gap-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl md:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
                <CalendarClock className="h-4 w-4" /> Cần kích hoạt gói tháng
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Thanh toán SePay để mở khóa AutoPost</h1>
                <p className="mt-4 max-w-2xl text-lg text-slate-300">
                  Xin chào {user.name}. Chuyển khoản đúng nội dung thanh toán, backend sẽ tự nhận webhook SePay và mở khóa tài khoản.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {['Webhook tự xác nhận tiền vào', 'Mã chuyển khoản riêng từng đơn', 'Gia hạn tự động 30 ngày'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                    <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
              {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-blue-300">Monthly Pro</p>
                  <h2 className="mt-2 text-3xl font-bold">{payment ? currency.format(payment.amount) : 'Theo cấu hình backend'}</h2>
                </div>
                <BadgeCheck className="h-10 w-10 text-blue-300" />
              </div>

              {!payment ? (
                <>
                  <ul className="space-y-3 text-sm text-slate-300">
                    <li>✓ Đăng bài nhóm Facebook tự động</li>
                    <li>✓ Upload ảnh bằng clipboard native macOS</li>
                    <li>✓ AI rewrite nội dung bán hàng</li>
                    <li>✓ License backend PostgreSQL/VPS</li>
                  </ul>
                  <button
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:shadow-blue-500/40 disabled:opacity-60"
                    onClick={handleCreatePayment}
                    disabled={loading}
                  >
                    {loading ? 'Đang tạo đơn...' : 'Tạo thanh toán SePay'} <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
                    <img src={payment.qrUrl} alt="QR thanh toán SePay" className="mx-auto max-h-72 w-full object-contain" />
                  </div>
                  <PaymentLine label="Ngân hàng" value={payment.bankName} onCopy={() => copy(payment.bankName)} />
                  <PaymentLine label="Số tài khoản" value={payment.accountNumber} onCopy={() => copy(payment.accountNumber)} />
                  <PaymentLine label="Chủ tài khoản" value={payment.accountHolder} onCopy={() => copy(payment.accountHolder)} />
                  <PaymentLine label="Số tiền" value={currency.format(payment.amount)} onCopy={() => copy(String(payment.amount))} />
                  <PaymentLine label="Nội dung CK" value={payment.transferCode} highlight onCopy={() => copy(payment.transferCode)} />

                  <div className="rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4 text-sm text-blue-100">
                    <div className="flex items-center gap-2 font-semibold">
                      {polling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      Đang chờ SePay xác nhận...
                    </div>
                    <p className="mt-2 text-blue-100/80">Trạng thái đơn: {order?.status}. App tự kiểm tra mỗi 5 giây.</p>
                  </div>
                </div>
              )}

              <button className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 hover:bg-white/5" onClick={logout}>
                Đăng xuất
              </button>
              {subscriptionEndsAt && <p className="mt-4 text-xs text-emerald-300">Hạn dùng: {new Date(subscriptionEndsAt).toLocaleString('vi-VN')}</p>}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#05070f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(37,99,235,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.22),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,1))]" />
      <main className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-sm text-blue-100 backdrop-blur">
            <Sparkles className="h-4 w-4" /> AutoPost FB AI Pro
          </div>
          <div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Tiodev, Tự động hóa đăng bài lên Facebook
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Vui lòng đăng nhập tài khoản để sử dụng hệ thống, nếu có vấn đề gì liên hệ Zalo :0977831621
            </p>
          </div>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              ['Bảo mật:', 'Tuyệt đối bảo mật 100%'],
              ['Hệ thống', 'Update đầy đủ linh hoạt'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
                <LockKeyhole className="mb-4 h-6 w-6 text-blue-300" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-300">Secure Access</p>
            <h2 className="mt-3 text-3xl font-bold">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
            <p className="mt-2 text-sm text-slate-400">Vui lòng đăng nhập</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Tên khách hàng</span>
                <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Email</span>
              <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="khachhang@email.com" type="email" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Mật khẩu</span>
              <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
            </label>

            {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <button className="mt-5 w-full text-sm text-slate-300 hover:text-white" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </section>
      </main>
    </div>
  );
}

function PaymentLine({ label, value, highlight, onCopy }: { label: string; value: string; highlight?: boolean; onCopy: () => void }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span className={`break-all font-semibold ${highlight ? 'text-emerald-200' : 'text-white'}`}>{value}</span>
        <button className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={onCopy} title="Copy">
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
