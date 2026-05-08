import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarClock, Copy, Crown, LockKeyhole, QrCode, RefreshCw, Sparkles, Star, Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { createSePayOrder, getPaymentOrder, type PricingPlan, type SePayOrder, type SePayPaymentInfo } from '@/services/paymentService';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const PLANS: PricingPlan[] = [
  { id: '1month', name: '1 Tháng', months: 1, days: 30, priceUsd: 29, priceVnd: 725000 },
  { id: '2months', name: '2 Tháng', months: 2, days: 60, priceUsd: 49, priceVnd: 1225000, badge: 'Phổ biến' },
  { id: '3months', name: '3 Tháng', months: 3, days: 90, priceUsd: 69, priceVnd: 1725000, badge: 'Tiết kiệm nhất' },
];

const planIcons = [<Zap key="z" className="h-6 w-6" />, <Star key="s" className="h-6 w-6" />, <Crown key="c" className="h-6 w-6" />];

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('2months');
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

  const handleCreatePayment = async (planId: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await createSePayOrder(planId);
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

  // ─── Payment screen (logged in, no active sub) ───
  if (user && !active) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#05070f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.28),transparent_34%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-10">

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
              <CalendarClock className="h-4 w-4" /> Chọn gói để mở khóa AutoPost
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Xin chào, {user.name}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Chọn gói phù hợp và chuyển khoản. Hệ thống sẽ tự động mở khóa tài khoản sau khi nhận được tiền.
            </p>
          </div>

          {!payment ? (
            <>
              {/* Plan cards */}
              <div className="grid w-full max-w-4xl gap-6 md:grid-cols-3">
                {PLANS.map((plan, i) => {
                  const isSelected = selectedPlan === plan.id;
                  const perMonth = Math.round(plan.priceUsd / plan.months);
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-[1.5rem] border-2 p-6 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500/10 shadow-xl shadow-blue-500/20 scale-[1.03]'
                          : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                          {plan.badge}
                        </span>
                      )}
                      <div className={`mb-4 inline-flex rounded-2xl p-3 ${isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-slate-300'}`}>
                        {planIcons[i]}
                      </div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <div className="mt-3">
                        <span className="text-4xl font-black">${plan.priceUsd}</span>
                        <span className="ml-1 text-sm text-slate-400">/ {plan.months} tháng</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{currency.format(plan.priceVnd)}</p>
                      <p className="mt-1 text-xs text-slate-500">~${perMonth}/tháng</p>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <div>✓ {plan.days} ngày sử dụng</div>
                        <div>✓ Đăng bài tự động</div>
                        <div>✓ AI rewrite nội dung</div>
                        <div>✓ Upload ảnh native</div>
                      </div>
                      {isSelected && (
                        <div className="mt-4 rounded-xl bg-blue-500/20 py-2 text-center text-sm font-semibold text-blue-200">
                          ✓ Đã chọn
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pay button */}
              <button
                className="mt-8 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:shadow-blue-500/40 disabled:opacity-60"
                onClick={() => handleCreatePayment(selectedPlan)}
                disabled={loading}
              >
                {loading ? 'Đang tạo đơn...' : 'Thanh toán ngay'} <ArrowRight className="h-5 w-5" />
              </button>

              {error && <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-3 text-sm text-red-200">{error}</div>}
            </>
          ) : (
            /* QR payment section */
            <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-blue-300">Thanh toán SePay</p>
                  <h2 className="mt-2 text-3xl font-bold">{currency.format(payment.amount)}</h2>
                </div>
                <BadgeCheck className="h-10 w-10 text-blue-300" />
              </div>

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
                  <p className="mt-2 text-blue-100/80">Trạng thái: {order?.status}. App tự kiểm tra mỗi 5 giây.</p>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <button className="mt-6 rounded-2xl border border-white/10 px-6 py-3 text-sm text-slate-300 hover:bg-white/5" onClick={logout}>
            Đăng xuất
          </button>
          {subscriptionEndsAt && <p className="mt-3 text-xs text-emerald-300">Hạn dùng: {new Date(subscriptionEndsAt).toLocaleString('vi-VN')}</p>}
        </main>
      </div>
    );
  }

  // ─── Login / Register screen ───
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
              ['Giá cả', 'Chỉ từ $29/tháng'],
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
