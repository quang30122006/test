import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';
import { Users, TrendingUp, Wallet, Trophy, BarChart3, ArrowRight } from 'lucide-react';
import { gsap, useGSAP, runReducedMotionAware } from '../utils/gsapSetup';
import { DashboardSkeleton } from './Skeleton';

export default function DashboardView({ selectedPeriod, onNavigate, notify }) {
  const dashRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retryLoad = () => {
    setError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/payroll/dashboard?period_code=${encodeURIComponent(selectedPeriod)}`);
        setData(res);
      } catch (err) {
        setError(err.message || 'Lỗi khi kết nối máy chủ');
        notify(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedPeriod, reloadKey]);

  useGSAP(() => {
    if (loading || !data) return;
    return runReducedMotionAware(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', clearProps: 'transform,opacity,visibility' } });
      tl.from('.dash-hero', { y: 6, autoAlpha: 0, duration: 0.4 })
        .from('.dash-kpi', { y: 6, autoAlpha: 0, duration: 0.38, stagger: 0.04 }, '-=0.25')
        .from('.dash-panel', { y: 6, autoAlpha: 0, duration: 0.38, stagger: 0.05 }, '-=0.25')
        .from('.dash-bar', { scaleX: 0, transformOrigin: 'left center', duration: 0.6, stagger: 0.03, ease: 'power2.out' }, '-=0.25');

      gsap.utils.toArray('.dash-count').forEach((el) => {
        const target = Number(el.dataset.target || 0);
        const digits = Number(el.dataset.digits || 0);
        const suffix = el.dataset.suffix || '';
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 0.75,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = digits > 0
              ? `${fmtNum(counter.val, digits)}${suffix}`
              : `${fmtMoney(counter.val)}${suffix}`;
          },
        });
      });
    });
  }, { scope: dashRef, dependencies: [loading, data?.period_code], revertOnUpdate: true });

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-sm text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Không thể tải Dashboard Điều hành</h3>
          <p className="text-xs text-rose-600 mt-1">{error || 'Không nhận được dữ liệu kỳ từ máy chủ'}</p>
        </div>
        <button
          onClick={retryLoad}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs font-bold shadow-sm cursor-pointer transition"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const d = data.dashboard || {};
  const tiers = d.tier_distribution || [];
  const salaryStruct = d.salary_structure || [];
  const top5 = data.top_performers || [];
  const v3 = data.v3_summary || {};
  const maxTierCount = Math.max(1, ...tiers.map((t) => t.count || 0));

  return (
    <div ref={dashRef} className="space-y-6">
      <div className="dash-hero bg-gradient-to-r from-[#801427] via-[#9E1B32] to-rose-700 text-white rounded-2xl p-6 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-rose-200">
            KHỐI 4 · MỤC 4.2 · DASHBOARD ĐIỀU HÀNH LÃNH ĐẠO ({data.org_name})
          </div>
          <h2 className="text-2xl font-extrabold mt-1">
            Tổng quan Hiệu suất & Tiền lương — {data.period_name}
          </h2>
          <p className="text-sm text-rose-100 mt-1">
            Số liệu hợp nhất tự động từ KPI 3 trụ cột, Bảng thanh toán lương 3P và Lũy kế Quỹ Thù lao V3.
          </p>
        </div>

        <button
          onClick={() => onNavigate('bang_luong_3p')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#9E1B32] hover:bg-rose-50 text-sm font-bold shadow-sm cursor-pointer self-start"
        >
          Mở Bảng lương 3P <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="dash-kpi bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Tổng nhân sự đánh giá</div>
            <div className="dash-count text-2xl font-extrabold text-slate-900 mt-1 tabular-nums" data-target={d.staff_count || 0} data-digits="0" data-suffix=" Cán bộ">
              {d.staff_count} Cán bộ
            </div>
            <div className="text-xs text-emerald-700 font-semibold mt-1">
              Tỷ lệ A+ & A: {((d.a_plus_a_rate || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="dash-kpi bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Điểm Công việc & TCV TB</div>
            <div className="dash-count text-2xl font-extrabold text-[#9E1B32] mt-1 tabular-nums" data-target={d.avg_work_score || 0} data-digits="2" data-suffix=" đ">
              {fmtNum(d.avg_work_score, 2)} đ
            </div>
            <div className="text-xs text-slate-600 font-semibold mt-1">
              Hệ số TCV TB: {((d.avg_tcv || 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-[#9E1B32]">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="dash-kpi bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Tổng Thu nhập 3P chi kỳ</div>
            <div className="dash-count text-2xl font-extrabold text-emerald-800 mt-1 tabular-nums" data-target={d.total_income_3p || 0} data-digits="0" data-suffix=" đ">
              {fmtMoney(d.total_income_3p)} đ
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Chênh lệch Quỹ V2: {fmtMoney(d.v2_surplus)} đ
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="dash-kpi bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">Dự kiến Quỹ Thù lao V3 năm</div>
            <div className="dash-count text-2xl font-extrabold text-amber-700 mt-1 tabular-nums" data-target={v3.v3_fund || 0} data-digits="0" data-suffix=" đ">
              {fmtMoney(v3.v3_fund)} đ
            </div>
            <div className="text-xs text-slate-500 mt-1">
              BS V2 cuối năm dự kiến: {fmtMoney(v3.v2_bonus_final)} đ
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
            <Trophy className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Phân bố Xếp loại & Cơ cấu Quỹ lương */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="dash-panel bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-5 h-5 text-[#9E1B32]" /> Phân bố Xếp loại KPI (A+ &rarr; D)
            </h3>
            <span className="text-xs text-slate-400">Tổng {d.staff_count} CB</span>
          </div>
          <div className="space-y-3">
            {tiers.map((t) => {
              const widthPct = Math.round(((t.count || 0) / maxTierCount) * 100);
              return (
                <div key={t.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${ratingBadgeClass(t.code)}`}>{t.code}</span>
                      <span className="text-slate-700 font-medium">{t.description}</span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {t.count} người ({((t.ratio || 0) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="dash-bar h-full rounded-full bg-[#9E1B32]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dash-panel bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Cơ cấu Quỹ Thu nhập 3P trong kỳ</h3>
          <div className="space-y-3">
            {salaryStruct.map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-bold text-slate-800">{s.label}</span>
                  <span className="font-extrabold text-[#9E1B32]">{fmtMoney(s.amount)} đ ({((s.ratio || 0) * 100).toFixed(1)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="dash-bar h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.min(100, Math.round((s.ratio || 0) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Performers */}
      <div className="dash-panel bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white font-bold text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-300" /> Top 5 Cán bộ Điểm Công việc & Hiệu suất cao nhất kỳ {data.period_name}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Họ và tên</th>
                <th className="px-4 py-2.5">Chức danh / Phòng</th>
                <th className="px-4 py-2.5 text-right">Điểm CM</th>
                <th className="px-4 py-2.5 text-right">Điểm KPI</th>
                <th className="px-4 py-2.5 text-right">Điểm Công việc</th>
                <th className="px-4 py-2.5 text-center">Xếp loại</th>
                <th className="px-4 py-2.5 text-right">Thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top5.map((r, i) => (
                <tr key={r.emp_code} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-extrabold text-[#9E1B32]">#{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{r.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.title} · {r.department}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(r.cm_score, 1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(r.kpi_score, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{fmtNum(r.work_score, 2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ratingBadgeClass(r.rating)}`}>{r.rating}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-extrabold text-emerald-700">{fmtMoney(r.takehome)} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

