import React, { useEffect, useRef, useState } from 'react';
import {
  Settings2, Lock, Unlock, Download, Database, Clock, CalendarDays,
  Users, TrendingUp, Wallet, Trophy, CheckCircle2, AlertTriangle,
  BarChart3, ShieldAlert, ArrowRight, History, SlidersHorizontal
} from 'lucide-react';
import { apiFetch, apiDownload } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';
import { gsap, useGSAP, runReducedMotionAware } from '../utils/gsapSetup';

function formatClockParts(now) {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = weekdays[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return {
    timeStr: `${hh}:${mm}:${ss}`,
    dateStr: `${dayName}, ngày ${dd}/${mo}/${yyyy}`,
  };
}

export default function AdminMenuHub({
  selectedPeriod,
  periods,
  onNavigate,
  onSelectPeriod,
  onOpenPeriodAction,
  ksvPendingCount,
}) {
  const hubRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
  const [dash, setDash] = useState(null);
  const [dsStatus, setDsStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);

  // Đồng hồ thực từng giây
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Tải đồng thời Dashboard, Trạng thái Dataset 12 tháng, Cấu hình Công thức và Nhật ký gần nhất
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [dRes, sRes, cRes, lRes] = await Promise.all([
          apiFetch(`/api/payroll/dashboard?period_code=${encodeURIComponent(selectedPeriod)}`),
          apiFetch('/api/operations/dataset/status?year_num=2026'),
          apiFetch('/api/admin/config'),
          apiFetch('/api/payroll/audit-log?limit=5'),
        ]);
        if (cancelled) return;
        setDash(dRes);
        setDsStatus(sRes);
        setCfg(cRes?.config || null);
        setLogs(lRes || []);
      } catch {
        // ignore transient errors cleanly
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedPeriod, periods.length]);

  useGSAP(() => {
    if (loading || !dash) return;
    return runReducedMotionAware(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity,visibility' } });
      tl.from('.cmd-hero', { y: 12, autoAlpha: 0, duration: 0.32 })
        .from('.cmd-kpi', { y: 14, autoAlpha: 0, duration: 0.32, stagger: 0.05 }, '-=0.18')
        .from('.cmd-panel', { y: 14, autoAlpha: 0, duration: 0.34, stagger: 0.06 }, '-=0.18')
        .from('.cmd-bar', { scaleX: 0, transformOrigin: 'left center', duration: 0.5, stagger: 0.035, ease: 'power2.out' }, '-=0.22');

      gsap.utils.toArray('.cmd-count').forEach((el) => {
        const target = Number(el.dataset.target || 0);
        const digits = Number(el.dataset.digits || 0);
        const suffix = el.dataset.suffix || '';
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 0.6,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = digits > 0
              ? `${fmtNum(counter.val, digits)}${suffix}`
              : `${fmtMoney(counter.val)}${suffix}`;
          },
        });
      });
    });
  }, { scope: hubRef, dependencies: [loading, dash?.period_code], revertOnUpdate: true });

  const { timeStr, dateStr } = formatClockParts(now);
  const d = dash?.dashboard || {};
  const tiers = d.tier_distribution || [];
  const salaryStruct = d.salary_structure || [];
  const top5 = dash?.top_performers || [];
  const v3 = dash?.v3_summary || {};
  const maxTierCount = Math.max(1, ...tiers.map((t) => t.count || 0));

  const months12 = dsStatus?.months || [];
  const curMonthMeta = months12.find((m) => m.period_code === selectedPeriod);
  const lockedCount = months12.filter((m) => m.status === 'ĐÃ KHÓA').length;

  return (
    <div ref={hubRef} className="space-y-5">
      {/* Banner điều hành + Đồng hồ Real-Time */}
      <div className="cmd-hero bg-gradient-to-r from-[#7B1225] via-[#9E1B32] to-rose-700 text-white rounded-2xl p-5 sm:p-6 shadow-md grid grid-cols-1 xl:grid-cols-12 gap-5 items-center">
        <div className="xl:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
              TRUNG TÂM ĐIỀU HÀNH LÃNH ĐẠO · AGRIBANK 3P
            </span>
            {curPeriod && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white text-[#9E1B32]">
                {curPeriod.period_name} · {curPeriod.status} · Kchuẩn {curPeriod.standard_days}d
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">
              Tổng quan Điều hành Tiền lương 3P & Hiệu suất KPI
            </h2>
            <p className="text-xs sm:text-sm text-rose-100 mt-1">
              Rê chuột vào <strong>Khối 1–4 ở thanh bên trái (3D Touch)</strong> để mở nhanh mọi nghiệp vụ, hoặc theo dõi trực tiếp các chỉ số trọng tâm của kỳ bên dưới.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onNavigate('formula_studio')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-[#9E1B32] hover:bg-rose-50 text-xs font-bold shadow-sm cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" /> Studio Công thức
            </button>
            <button
              onClick={() => onNavigate('dataset_manager')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" /> Dataset 12 Tháng
            </button>
            <button
              onClick={() => onOpenPeriodAction('close')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Khóa kỳ
            </button>
            <button
              onClick={() => onOpenPeriodAction('open')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" /> Mở kỳ mới
            </button>
            <button
              onClick={() => apiDownload(`/api/payroll/export-excel?period_code=${selectedPeriod}`, `BangLuong_3P_${selectedPeriod}.xlsx`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel 3P
            </button>
          </div>
        </div>

        {/* Đồng hồ & Ngày tháng thời gian thực */}
        <div className="xl:col-span-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between text-xs text-rose-100">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Clock className="w-4 h-4 text-amber-300" /> Thời gian hệ thống
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-100 border border-emerald-300/30 font-bold text-[10px]">
              Đang hoạt động
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-white">
            {timeStr}
          </div>
          <div className="text-xs sm:text-sm font-medium text-amber-200 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span>{dateStr}</span>
          </div>
          <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-rose-100">
            <span>Đã khóa sổ: <strong className="text-white">{lockedCount}/12 kỳ</strong></span>
            <span>Chờ KSV duyệt: <strong className={ksvPendingCount > 0 ? 'text-amber-300' : 'text-white'}>{ksvPendingCount} phiếu</strong></span>
          </div>
        </div>
      </div>

      {/* 4 Thẻ chỉ số trọng tâm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="cmd-kpi bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Nhân sự & Điểm Công việc TB</div>
            <div className="cmd-count text-2xl font-extrabold text-slate-900 mt-1 tabular-nums" data-target={d.avg_work_score || 0} data-digits="2" data-suffix=" đ">
              {fmtNum(d.avg_work_score || 0, 2)} đ
            </div>
            <div className="text-xs text-emerald-700 font-semibold mt-1">
              {d.staff_count || 0} CB · Hạng A+/A: {((d.a_plus_a_rate || 0) * 100).toFixed(1)}% · Tcv TB {((d.avg_tcv || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="cmd-kpi bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Tổng Quỹ Thu nhập 3P Kỳ</div>
            <div className="cmd-count text-2xl font-extrabold text-emerald-800 mt-1 tabular-nums" data-target={d.total_income_3p || 0} data-digits="0" data-suffix=" đ">
              {fmtMoney(d.total_income_3p || 0)} đ
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Chênh lệch Quỹ V2: <strong className="text-[#9E1B32]">{fmtMoney(d.v2_surplus || 0)} đ</strong>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="cmd-kpi bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Quỹ Thù lao V3 Dự kiến Năm</div>
            <div className="cmd-count text-2xl font-extrabold text-amber-700 mt-1 tabular-nums" data-target={v3.v3_fund || 0} data-digits="0" data-suffix=" đ">
              {fmtMoney(v3.v3_fund || 0)} đ
            </div>
            <div className="text-xs text-slate-500 mt-1">
              BS V2 cuối năm: <strong>{fmtMoney(v3.v2_bonus_final || 0)} đ</strong>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        {/* Sức khỏe dữ liệu kỳ */}
        <div className="cmd-kpi bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Sức khỏe Dữ liệu Kỳ</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              curMonthMeta?.readiness === 'Đủ dữ liệu chi tiết' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {curMonthMeta?.readiness || 'Đang tải...'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] text-center">
            <button
              onClick={() => onNavigate('import_salary')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 cursor-pointer"
              title="Mở Tiếp nhận Bảng lương"
            >
              <div className="text-slate-500">Lương V1+V2</div>
              <div className={`font-extrabold ${(curMonthMeta?.salary_count || 0) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {curMonthMeta?.salary_count ?? 0} CB
              </div>
            </button>
            <button
              onClick={() => onNavigate('import_targets')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200 cursor-pointer"
              title="Mở Tiếp nhận Chỉ tiêu GK"
            >
              <div className="text-slate-500">Chỉ tiêu P2</div>
              <div className={`font-extrabold ${(curMonthMeta?.target_count || 0) > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {curMonthMeta?.target_count ?? 0} dòng
              </div>
            </button>
            <button
              onClick={() => onNavigate('ksv_queue')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200 cursor-pointer"
              title="Mở Hàng chờ KSV"
            >
              <div className="text-slate-500">Chờ KSV</div>
              <div className={`font-extrabold ${ksvPendingCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                {ksvPendingCount} phiếu
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Khu vực Trung tâm: Biểu đồ + Tiến độ 12 kỳ + Top 5 + Tham số + Nhật ký */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cột Trái (7/12): Biểu đồ & Timeline 12 kỳ */}
        <div className="lg:col-span-7 space-y-5">
          <div className="cmd-panel bg-white rounded-2xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phân bố xếp loại */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#9E1B32]" /> Phân bố Xếp loại (A+ &rarr; D)
                </h3>
                <button
                  onClick={() => onNavigate('kpi_month')}
                  className="text-xs font-semibold text-[#9E1B32] hover:underline cursor-pointer"
                >
                  Chi tiết KPI &rarr;
                </button>
              </div>
              <div className="space-y-2.5">
                {tiers.map((t) => {
                  const widthPct = Math.round(((t.count || 0) / maxTierCount) * 100);
                  return (
                    <div key={t.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${ratingBadgeClass(t.code)}`}>{t.code}</span>
                          <span className="text-slate-600 truncate max-w-[130px]">{t.description}</span>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {t.count} ({((t.ratio || 0) * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="cmd-bar h-full rounded-full bg-[#9E1B32]" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cơ cấu quỹ lương 3P */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-700" /> Cơ cấu Quỹ Lương 3P
                </h3>
                <button
                  onClick={() => onNavigate('payroll_3p')}
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Bảng lương 3P &rarr;
                </button>
              </div>
              <div className="space-y-2.5">
                {salaryStruct.map((s) => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{s.label}</span>
                      <span className="font-extrabold text-[#9E1B32] tabular-nums">
                        {fmtMoney(s.amount)} đ ({((s.ratio || 0) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="cmd-bar h-full rounded-full bg-emerald-600"
                        style={{ width: `${Math.min(100, Math.round((s.ratio || 0) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Thanh tiến độ 12 kỳ năm 2026 */}
          <div className="cmd-panel bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Lịch trình 12 Kỳ Tính lương Năm 2026 (Nhấp vào tháng để chuyển kỳ nhanh)
              </h3>
              <button
                onClick={() => onNavigate('periods')}
                className="text-xs font-semibold text-[#9E1B32] hover:underline cursor-pointer"
              >
                Quản lý đóng/mở kỳ &rarr;
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {months12.map((m) => {
                const isSelected = m.period_code === selectedPeriod;
                const isOpen = m.status === 'ĐANG MỞ';
                const isLocked = m.status === 'ĐÃ KHÓA';
                return (
                  <button
                    key={m.period_code}
                    onClick={() => { if (onSelectPeriod) onSelectPeriod(m.period_code); }}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-[#9E1B32] ring-2 ring-rose-200'
                        : isOpen
                        ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50'
                        : isLocked
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        : 'bg-white border-slate-200 hover:bg-slate-50 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
                      <span>T{m.month_num}</span>
                      {isLocked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                      ) : isOpen ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5 truncate text-slate-600">{m.status}</div>
                    <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                      {m.salary_count > 0 ? `${m.salary_count} CB · ${m.target_count} CT` : m.snapshot_count > 0 ? 'Snapshot V3' : 'Trống'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cột Phải (5/12): Top 5 + Tham số công thức hiệu lực + Audit Log gần nhất */}
        <div className="lg:col-span-5 space-y-5">
          {/* Top 5 */}
          <div className="cmd-panel bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-300" /> Top 5 Hiệu suất Kỳ {dash?.period_name}
              </span>
              <button
                onClick={() => onNavigate('payslip_admin')}
                className="text-[11px] font-semibold text-amber-300 hover:underline cursor-pointer"
              >
                Tìm & In CB
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {top5.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                  Kỳ này chưa có số liệu tính lương 3P. Hãy nạp Lương & Chỉ tiêu từ Khối 2.
                </div>
              ) : (
                top5.map((r, i) => (
                  <button
                    key={r.emp_code}
                    onClick={() => onNavigate('print_reports', { tab: 'payslip', empCode: r.emp_code })}
                    className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-rose-50/50 transition cursor-pointer"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className="font-black text-xs text-[#9E1B32] w-5">#{i + 1}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">{r.full_name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{r.title} · {fmtNum(r.work_score, 1)}đ</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-xs sm:text-sm text-emerald-700 tabular-nums">{fmtMoney(r.takehome)} đ</div>
                      <span className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold ${ratingBadgeClass(r.rating)}`}>
                        {r.rating}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Tham số công thức đang hiệu lực */}
          {cfg && (
            <div className="cmd-panel bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#9E1B32]" /> Cấu hình Công thức đang hiệu lực
                </h3>
                <button
                  onClick={() => onNavigate('formula_studio')}
                  className="text-xs font-semibold text-[#9E1B32] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Chỉnh sửa <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-slate-400">Trọng số 3 Trụ cột</div>
                  <div className="font-bold text-slate-800">
                    CM {(cfg.w_cm * 100).toFixed(0)}% · KPI {(cfg.w_kpi * 100).toFixed(0)}% · DP {(cfg.w_reserve * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-slate-400">3 Nhánh KPI (P2)</div>
                  <div className="font-bold text-slate-800">
                    HDV {(cfg.w_kpi_hdv * 100).toFixed(0)}% · DV {(cfg.w_kpi_dv * 100).toFixed(0)}% · DN {(cfg.w_kpi_dn * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-slate-400">Cơ chế Tcv & Trần</div>
                  <div className="font-bold text-slate-800">
                    {cfg.tcv_mode} · Trần {(cfg.tcv_max_cap * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-slate-400">Phân bổ Quỹ V3</div>
                  <div className="font-bold text-slate-800 truncate">{cfg.v3_allocation_method}</div>
                </div>
              </div>
            </div>
          )}

          {/* Nhật ký kiểm toán gần nhất */}
          <div className="cmd-panel bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <History className="w-4 h-4 text-sky-700" /> Hoạt động Hệ thống gần nhất
              </h3>
              <button
                onClick={() => onNavigate('audit_log')}
                className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
              >
                Xem toàn bộ &rarr;
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {logs.length === 0 ? (
                <div className="text-slate-400 py-2">Chưa có thao tác ghi nhận.</div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800">{l.action}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600 line-clamp-1">{l.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{l.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
