import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass, ksvStatusBadge } from '../utils/format';
import { Printer, Check, X, BookOpen, Search, ShieldCheck, Calendar, TrendingUp, Award } from 'lucide-react';
import { gsap, useGSAP, runReducedMotionAware } from '../utils/gsapSetup';

export default function StaffPortalView({ user, activeTab, notify }) {
  const staffRef = useRef(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [payslip, setPayslip] = useState(null);
  const [accData, setAccData] = useState(null);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [attViol, setAttViol] = useState(null);
  const [rules, setRules] = useState([]);
  const [kpiCodes, setKpiCodes] = useState([]);
  const [codeSearch, setCodeSearch] = useState('');
  const [ksvNotes, setKsvNotes] = useState({});
  const [loading, setLoading] = useState(false);

  const loadPayslip = async (pcode = selectedPeriod) => {
    setLoading(true);
    try {
      const q = pcode ? `?period_code=${encodeURIComponent(pcode)}` : '';
      const res = await apiFetch(`/api/staff/my-payslip${q}`);
      setPayslip(res);
      if (!selectedPeriod && res.period_code) {
        setSelectedPeriod(res.period_code);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAccumulation = async (incOpen = includeOpen) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/staff/my-accumulation?include_open=${incOpen}`);
      setAccData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAttViol = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/staff/my-attendance-violations');
      setAttViol(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const [rRes, kRes] = await Promise.all([
        apiFetch('/api/catalogs/internal-rules'),
        apiFetch('/api/catalogs/kpi-error-codes?limit=1200'),
      ]);
      setRules(rRes || []);
      setKpiCodes(kRes.items || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my_payslip') loadPayslip(selectedPeriod);
    else if (activeTab === 'my_accumulation') loadAccumulation(includeOpen);
    else if (activeTab === 'my_attendance_violations') loadAttViol();
    else if (activeTab === 'my_rules') loadRules();
  }, [activeTab]);

  useGSAP(() => {
    if (loading) return;
    return runReducedMotionAware(() => {
      gsap.from('.staff-card', {
        y: 12,
        autoAlpha: 0,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility',
      });
    });
  }, { scope: staffRef, dependencies: [activeTab, loading, selectedPeriod], revertOnUpdate: true });

  const handleStaffKsvDecision = async (recordCode, decision) => {
    try {
      const res = await apiFetch(`/api/staff/ksv-review/${recordCode}`, {
        method: 'POST',
        body: JSON.stringify({ decision, ksv_note: ksvNotes[recordCode] || '' }),
      });
      notify(res.message || 'Đã gửi kết quả thẩm duyệt');
      loadAttViol();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (activeTab === 'my_payslip') {
    const periods = payslip?.available_periods || [];
    const kpi = payslip?.kpi;
    const pay = payslip?.payroll;
    return (
      <div ref={staffRef} className="space-y-5">
        <div className="staff-card no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#9E1B32] mb-1">
              CỔNG CÁN BỘ NHÂN VIÊN · PHIẾU LƯƠNG & KPI CÁ NHÂN
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Xin chào {user.full_name} ({user.emp_code})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Dữ liệu được bảo mật riêng tư ở cấp độ máy chủ: chỉ hiển thị thông tin lương & KPI của chính bạn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPeriod || payslip?.period_code || ''}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                loadPayslip(e.target.value);
              }}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white outline-none focus:border-[#9E1B32]"
            >
              {periods.map((p) => (
                <option key={p.period_code} value={p.period_code}>
                  {p.period_name} ({p.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" /> In phiếu lương
            </button>
          </div>
        </div>

        {loading || !payslip ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Đang tải phiếu lương...</div>
        ) : pay && kpi ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="staff-card bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Điểm Chuyên môn (P1+P3)</div>
                <div className="text-2xl font-extrabold text-sky-700 mt-1">{fmtNum(kpi.cm_score, 1)} đ</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Trừ TT: {kpi.direct_deduction} · KSV: {kpi.ksv_deduction}
                </div>
              </div>
              <div className="staff-card bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Điểm KPI Kinh doanh (P2)</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{fmtNum(kpi.kpi_score, 2)} đ</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  HDV {((kpi.pct_hdv || 0) * 100).toFixed(0)}% · DV {((kpi.pct_dv || 0) * 100).toFixed(0)}% · DN {((kpi.pct_dn || 0) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="staff-card bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold">Tổng điểm CV & Xếp loại</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-[#9E1B32]">{fmtNum(kpi.work_score, 2)}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${ratingBadgeClass(kpi.rating)}`}>
                    {kpi.rating} ({(kpi.tcv * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="staff-card bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
                <div className="text-xs text-emerald-800 font-bold">Thực nhận Kỳ {payslip.period_name}</div>
                <div className="text-2xl font-extrabold text-emerald-900 mt-1">{fmtMoney(pay.takehome)} đ</div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Công: {fmtNum(pay.actual_workdays, 1)}/{pay.standard_workdays} ngày
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900">Chi tiết Thanh toán Tiền lương 3P ({payslip.org_name})</h3>
                <span className="text-xs text-slate-500 italic">Bằng chữ: {payslip.takehome_in_words}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">V1 Định mức &rarr; V1 Thực lĩnh</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {fmtMoney(pay.base_v1)} &rarr; <span className="text-sky-700">{fmtMoney(pay.v1_actual)} đ</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">V2 Định mức &rarr; V2 Thực hưởng</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {fmtMoney(pay.base_v2)} &rarr; <span className="text-[#9E1B32]">{fmtMoney(pay.v2_adj)} đ</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Phân bổ QNS (NSi) & Chênh lệch</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {fmtMoney(pay.nsi)} đ ({pay.diff_ns >= 0 ? `+${fmtMoney(pay.diff_ns)}` : fmtMoney(pay.diff_ns)})
                  </div>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase text-slate-500 pt-2">Chi tiết 8 Chỉ tiêu Giao khoán P2 của bạn</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Chỉ tiêu</th>
                      <th className="px-3 py-2.5 text-center">Nhánh</th>
                      <th className="px-3 py-2.5 text-right">Trọng số</th>
                      <th className="px-3 py-2.5 text-right">Mục tiêu Ti</th>
                      <th className="px-3 py-2.5 text-right">Thực hiện Ai</th>
                      <th className="px-3 py-2.5 text-right">Tỷ lệ Ci</th>
                      <th className="px-3 py-2.5 text-right">Điểm Si</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(payslip.targets || []).map((t) => (
                      <tr key={t.indicator_code} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">{t.indicator_name}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-600">{t.kpi_branch}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{(t.weight_wi * 100).toFixed(0)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.target_value, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-[#9E1B32]">{fmtNum(t.actual_value, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{(t.ratio_ci * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{fmtNum(t.score_si, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            Bạn chưa có dữ liệu bảng lương trong kỳ {payslip.period_name}.
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'my_accumulation') {
    const r = accData?.row;
    const yr = r?.year || {};
    return (
      <div ref={staffRef} className="space-y-5">
        <div className="staff-card bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#9E1B32] mb-1">
              TÍCH LŨY 12 THÁNG & DỰ KIẾN QUỸ THÙ LAO V3 CÁ NHÂN
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Tổng hợp năm {accData?.year_num || 2026} — {user.full_name}
            </h2>
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => {
                setIncludeOpen(e.target.checked);
                loadAccumulation(e.target.checked);
              }}
              className="accent-[#9E1B32]"
            />
            Tính dự kiến cả kỳ đang mở hiện tại
          </label>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Đang tải dữ liệu tích lũy...</div>
        ) : !r ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Chưa có dữ liệu tích lũy cho cán bộ này.</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500">KPI Bình quân Năm & Xếp loại</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-extrabold text-slate-900">{fmtNum(yr.kpi_bq, 2)}đ</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ratingBadgeClass(yr.rating)}`}>
                    {yr.rating} (H3={fmtNum(yr.h3, 2)})
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500">Tổng công tích lũy năm</div>
                <div className="text-xl font-extrabold text-sky-700 mt-1">{fmtNum(yr.workdays, 1)} ngày ({yr.months_active}T)</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs text-slate-500">Bổ sung V2 (Quý + Cuối năm)</div>
                <div className="text-xl font-extrabold text-amber-700 mt-1">
                  {fmtMoney((yr.total_bs_quarters || 0) + (yr.v2_bonus_final || 0))} đ
                </div>
              </div>
              <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4 shadow-sm">
                <div className="text-xs font-bold text-[#9E1B32]">Dự kiến Thù lao V3 của bạn</div>
                <div className="text-xl font-extrabold text-[#9E1B32] mt-1">{fmtMoney(yr.v3_amount)} đ</div>
                <div className="text-[11px] text-rose-700">Tỷ trọng: {(yr.v3_ratio * 100).toFixed(2)}%</div>
              </div>
            </div>

            {/* 4 Quý */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#9E1B32]" /> Quyết toán V2 từng Quý (Q1–Q4)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                  const qd = r.quarters[q];
                  return (
                    <div key={q} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">QUÝ {q.replace('Q', '')}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold ${ratingBadgeClass(qd.rating)}`}>{qd.rating}</span>
                      </div>
                      <div className="flex justify-between"><span>KPI BQ:</span><strong>{fmtNum(qd.kpi_bq, 2)}</strong></div>
                      <div className="flex justify-between"><span>V2 QT:</span><strong>{fmtMoney(qd.v2_qt)} đ</strong></div>
                      <div className="flex justify-between"><span>Đã lĩnh:</span><span>{fmtMoney(qd.v2_paid)} đ</span></div>
                      <div className="flex justify-between text-[#9E1B32] font-bold pt-1 border-t border-slate-200">
                        <span>Bổ sung V2:</span><span>+{fmtMoney(qd.v2_bonus)} đ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 12 tháng */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-900 text-white font-bold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-300" /> Bảng chi tiết 12 tháng trong năm
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Tháng</th>
                      <th className="px-3 py-2.5 text-right">Điểm KPI</th>
                      <th className="px-3 py-2.5 text-right">Ngày công</th>
                      <th className="px-3 py-2.5 text-right">V2 đã lĩnh</th>
                      <th className="px-3 py-2.5 text-right">V1 thực lĩnh</th>
                      <th className="px-3 py-2.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => {
                      const md = r.months[m] || {};
                      const has = md.kpi_score !== null && md.kpi_score !== undefined;
                      return (
                        <tr key={m} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-900">Tháng {m}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{has ? `${fmtNum(md.kpi_score, 2)} đ` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{has ? `${fmtNum(md.workdays, 1)} ngày` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#9E1B32]">{has ? `${fmtMoney(md.v2_paid)} đ` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{has ? `${fmtMoney(md.v1_paid)} đ` : '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {has ? (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${md.is_frozen ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
                                {md.is_frozen ? 'Đã khóa sổ' : 'Dự kiến kỳ mở'}
                              </span>
                            ) : (
                              <span className="text-slate-300">Chưa phát sinh</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'my_attendance_violations') {
    const att = attViol?.attendance || [];
    const myViols = attViol?.my_violations || [];
    const ksvAssigned = attViol?.ksv_assigned || [];
    return (
      <div ref={staffRef} className="space-y-6">
        <div className="staff-card bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#9E1B32] mb-1">
            CHẤM CÔNG · VI PHẠM CÁ NHÂN & PHÊ DUYỆT LIÊN ĐỚI KSV
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Theo dõi Công, Lỗi ghi nhận & Hàng chờ KSV của tôi</h2>
        </div>

        {/* Nếu bạn là KSV được gán lỗi liên đới */}
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="bg-amber-600 text-white px-5 py-3 font-bold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Hồ sơ Kiểm soát viên (KSV) phân công cho bạn xác nhận ({ksvAssigned.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-amber-50 text-amber-900 text-xs uppercase border-b border-amber-200">
                <tr>
                  <th className="px-3 py-2.5">Mã BB</th>
                  <th className="px-3 py-2.5">Cán bộ vi phạm & Lỗi</th>
                  <th className="px-3 py-2.5 text-right">Đề xuất trừ KSV</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5">Ý kiến của bạn</th>
                  <th className="px-3 py-2.5 text-center">Xác nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ksvAssigned.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">Bạn không có biên bản KSV liên đới nào cần xử lý.</td>
                  </tr>
                ) : (
                  ksvAssigned.map((v) => {
                    const st = ksvStatusBadge(v.ksv_status);
                    return (
                      <tr key={v.record_code} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono font-bold">{v.record_code}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{v.emp_name} · <span className="font-mono text-rose-700">{v.error_code}</span></div>
                          <div className="text-xs text-slate-500">{v.error_detail}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-amber-700">-{fmtNum(v.ksv_proposed_points, 1)}đ</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={ksvNotes[v.record_code] ?? v.ksv_note ?? ''}
                            onChange={(e) => setKsvNotes({ ...ksvNotes, [v.record_code]: e.target.value })}
                            placeholder="Giải trình của KSV..."
                            className="w-44 px-2 py-1 border border-slate-300 rounded-lg text-xs"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleStaffKsvDecision(v.record_code, 'APPROVED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Chấp nhận
                            </button>
                            <button
                              onClick={() => handleStaffKsvDecision(v.record_code, 'REJECTED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> Từ chối
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bảng công các kỳ mở/gần đây */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-900 text-white font-bold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-300" /> Bảng Chấm công của bạn
            </div>
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2.5">Kỳ lương</th>
                  <th className="px-3 py-2.5 text-right">Công chuẩn</th>
                  <th className="px-3 py-2.5 text-right">Công thực tế</th>
                  <th className="px-3 py-2.5">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {att.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">Chưa có dữ liệu chấm công</td></tr>
                ) : (
                  att.map((a) => (
                    <tr key={a.period_code}>
                      <td className="px-3 py-2.5 font-bold">{a.period_name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.standard_days}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#9E1B32]">{fmtNum(a.actual_workdays, 1)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{a.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Vi phạm trực tiếp */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-900 text-white font-bold text-sm">
              Biên bản Lỗi vi phạm của bạn ({myViols.length})
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2.5">Mã BB / Kỳ</th>
                  <th className="px-3 py-2.5">Mã lỗi & Chi tiết</th>
                  <th className="px-3 py-2.5 text-right">Điểm trừ CB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myViols.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-emerald-600 font-semibold">Bạn chưa có biên bản lỗi vi phạm nào!</td></tr>
                ) : (
                  myViols.map((v) => (
                    <tr key={v.record_code}>
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold">{v.record_code}</div>
                        <div className="text-[11px] text-slate-400">{v.period_name}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold text-rose-700">{v.error_code}</div>
                        <div className="text-slate-600">{v.error_detail}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-rose-700">
                        -{fmtNum(v.emp_deduction, 1)}đ
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Tab: Tra cứu Quy chế & Danh mục
  const q = codeSearch.trim().toLowerCase();
  const fRules = rules.filter((r) => !q || r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  const fKpi = kpiCodes.filter((c) => !q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)).slice(0, 100);

  return (
    <div ref={staffRef} className="space-y-5">
      <div className="staff-card bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#9E1B32] mb-1">
            TRA CỨU QUY CHẾ NỘI QUY (P1) & BỘ MÃ KPI NGHIỆP VỤ (P3)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Kho quy định minh bạch áp dụng toàn Chi nhánh</h2>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
            placeholder="Tìm mã nội quy / mã KPI..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-900 text-white font-bold text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-300" /> 16 Quy định Nội quy & Kỷ luật (P1)
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {fRules.map((r) => (
              <div key={r.code} className="p-3.5 flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white mr-2">{r.code}</span>
                  <span className="text-xs font-semibold text-amber-700">{r.group_name}</span>
                  <div className="text-xs sm:text-sm text-slate-800 mt-1">{r.description}</div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
                  -{Math.abs(r.points)}đ
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#9E1B32] text-white font-bold text-sm">
            Bộ mã KPI Nghiệp vụ (Hiển thị tối đa 100/{kpiCodes.length} mã khớp)
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {fKpi.map((c) => (
              <div key={c.code} className="p-3 flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white mr-2">{c.code}</span>
                  <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-600">{c.level_name}</span>
                  <div className="text-xs text-slate-700 mt-1">{c.description}</div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
                  -{Math.abs(c.points)}đ
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

