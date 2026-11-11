import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserCheck, Lock, Eye, EyeOff, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { apiFetch, setToken } from '../api';
import { gsap, useGSAP, runReducedMotionAware, animateTabContentEnter } from '../utils/gsapSetup';
import SlidingTabs from './SlidingTabs';

export default function LoginView({ onLoginSuccess }) {
  const containerRef = useRef(null);
  const formStageRef = useRef(null);
  const isFirstTabRef = useRef(true);
  const [tab, setTab] = useState('STAFF'); // 'STAFF' | 'ADMIN'
  const [staffList, setStaffList] = useState([]);
  const [empCode, setEmpCode] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/auth/staff-directory')
      .then((list) => {
        setStaffList(list || []);
        if (list && list.length > 0) {
          setEmpCode(list[0].emp_code);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (tab === 'ADMIN') {
        data = await apiFetch('/api/auth/login-admin', {
          method: 'POST',
          body: JSON.stringify({ password: adminPassword }),
        });
      } else {
        data = await apiFetch('/api/auth/login-staff', {
          method: 'POST',
          body: JSON.stringify({ emp_code: empCode, password: staffPassword }),
        });
      }
      setToken(data.access_token);
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  useGSAP(() => {
    return runReducedMotionAware(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity,visibility' } });
      tl.from('.login-panel', { y: 18, autoAlpha: 0, duration: 0.45, stagger: 0.08 })
        .from('.login-feature', { y: 12, autoAlpha: 0, duration: 0.35, stagger: 0.06 }, '-=0.25');
    });
  }, { scope: containerRef });

  useGSAP(() => {
    if (isFirstTabRef.current) {
      isFirstTabRef.current = false;
      return;
    }
    if (!formStageRef.current) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(formStageRef.current, { y: 10, duration: 0.28 });
    });
  }, { scope: containerRef, dependencies: [tab] });

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-100 via-rose-50/40 to-slate-100 flex flex-col justify-center py-8 px-4">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Cột trái: Thông tin hệ thống Agribank 3P */}
        <div className="login-panel lg:col-span-6 bg-[#8B152B] text-white rounded-2xl p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-12 w-48 h-48 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-6 border border-white/20">
              <Building2 className="w-4 h-4 text-amber-300" />
              AGRIBANK - CHI NHÁNH TỈNH QUẢNG BÌNH
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
              AGRIBANK 3P — QUẢN TRỊ TIỀN LƯƠNG &amp; ĐÁNH GIÁ KPI
            </h1>
            <p className="text-rose-100 text-sm leading-relaxed mb-6">
              Nền tảng Web chuẩn hóa <strong>AGRIBANK 3P</strong> — Phân luồng rõ ràng giữa <strong>Cổng Quản trị / Ban Giám đốc</strong> và <strong>Cổng Cán bộ Nhân viên</strong>, tích hợp đầy đủ 4 khối nghiệp vụ &amp; Studio chỉnh sửa công thức toàn diện.
            </p>

            <div className="space-y-3 text-xs sm:text-sm text-rose-50/95">
              <div className="login-feature bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="font-bold text-amber-300 mb-1">1. Phân luồng bảo mật đa cấp</div>
                Cán bộ chỉ xem được Phiếu lương, Tích lũy V3, Chấm công & Vi phạm của cá nhân (KSV được thẩm duyệt biên bản liên đới được giao).
              </div>
              <div className="login-feature bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="font-bold text-amber-300 mb-1">2. Studio Công thức & Trọng số linh hoạt</div>
                Nhà quản trị tùy chỉnh toàn bộ trọng số (75%/25%), sàn/trần CM, cơ chế T<sub>cv</sub>, Ma trận hệ số A+..D, Quỹ Q<sub>NS</sub>, phương thức chia Thù lao V3 kèm giả lập Trước/Sau tức thì.
              </div>
              <div className="login-feature bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="font-bold text-amber-300 mb-1">3. Khắc phục triệt để các điểm khuyết Excel</div>
                Chuẩn hóa import Excel động, đồng bộ trọn vẹn 290 mã Phụ lục 3 + 828 mã mở rộng, bù sai số làm tròn tự động và lưu vết 12 kỳ độc lập.
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/20 text-xs text-rose-200 flex items-center justify-between">
            <span>Cơ chế 3P: V1 (Vị trí) + V2 (Hiệu quả) + V3 (Thù lao năm)</span>
            <span className="font-semibold text-white">AGRIBANK 3P Web Edition</span>
          </div>
        </div>

        {/* Cột phải: Form Đăng nhập 2 luồng */}
        <div className="login-panel lg:col-span-6 bg-white rounded-2xl p-8 shadow-xl border border-slate-200 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Đăng nhập Hệ thống</h2>
            <p className="text-sm text-slate-500 mt-1">Vui lòng chọn đúng luồng truy cập theo vai trò của bạn</p>
          </div>

          {/* Tabs 2 luồng */}
          <SlidingTabs
            items={[
              { id: 'STAFF', label: 'Cán bộ Nhân viên', icon: UserCheck, activeTextClass: 'text-[#9E1B32]' },
              { id: 'ADMIN', label: 'Quản trị / Giám đốc', icon: ShieldCheck, activeTextClass: 'text-white' },
            ]}
            value={tab}
            onChange={(nextTab) => { setTab(nextTab); setError(''); }}
            className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6"
            buttonClassName="py-2.5 px-3 rounded-lg text-sm font-semibold"
            pillStyleMap={{
              STAFF: 'bg-white shadow-sm border border-slate-200 rounded-lg',
              ADMIN: 'bg-[#9E1B32] shadow-sm rounded-lg',
            }}
          />

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form ref={formStageRef} onSubmit={handleSubmit} className="space-y-4">
            {tab === 'STAFF' ? (
              <>
                {staffList.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Chọn nhanh Cán bộ
                    </label>
                    <select
                      value={empCode}
                      onChange={(e) => setEmpCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/30 focus:border-[#9E1B32]"
                    >
                      {staffList.map((s) => (
                        <option key={s.emp_code} value={s.emp_code}>
                          {s.emp_code} — {s.full_name} ({s.title})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {staffList.length > 0 ? 'Hoặc gõ trực tiếp Mã Cán bộ' : 'Mã Cán bộ'}
                  </label>
                  <input
                    type="text"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="VD: 3800207001465"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/30 focus:border-[#9E1B32]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Mật khẩu Cán bộ
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      className="w-full rounded-xl border border-slate-300 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/30 focus:border-[#9E1B32]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Nhập mật khẩu cá nhân (vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên).
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Mật khẩu Quản trị / Ban Giám đốc
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu quản trị..."
                    className="w-full rounded-xl border border-slate-300 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/30 focus:border-[#9E1B32]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Mật khẩu khởi tạo: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">123456</code></span>
                  <button
                    type="button"
                    onClick={() => setAdminPassword('123456')}
                    className="inline-flex items-center gap-1 text-[#9E1B32] font-semibold hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Điền nhanh
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#9E1B32] hover:bg-[#801427] text-white font-semibold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Đang xác thực...' : (tab === 'ADMIN' ? 'Đăng nhập Quản trị Hệ thống' : 'Đăng nhập Cổng Cán bộ')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
