import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, apiDownload } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';
import { useGSAP, runReducedMotionAware, animateTabContentEnter } from '../utils/gsapSetup';
import SlidingTabs from './SlidingTabs';
import { Printer, Download, UserCheck, FileText, Award, Search } from 'lucide-react';

export default function PrintReportsView({ selectedPeriod, initialTab = 'payslip', initialEmpCode = '', notify }) {
  const [tab, setTab] = useState(initialTab); // 'payslip' | 'v2' | 'v3'
  const [employees, setEmployees] = useState([]);
  const [empQuery, setEmpQuery] = useState('');
  const [empCode, setEmpCode] = useState(initialEmpCode);
  const [profileMode, setProfileMode] = useState('slip'); // 'slip' | 'full_profile'
  const [includeOpenV3, setIncludeOpenV3] = useState(false);

  const [payslip, setPayslip] = useState(null);
  const [v2Data, setV2Data] = useState(null);
  const [v3Data, setV3Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const reportStageRef = useRef(null);

  useGSAP(() => {
    if (!reportStageRef.current || loading) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(reportStageRef.current, { y: 12, duration: 0.3 });
    });
  }, { dependencies: [tab, profileMode, empCode, loading] });

  useEffect(() => {
    setTab(initialTab || 'payslip');
  }, [initialTab]);

  useEffect(() => {
    if (initialEmpCode) setEmpCode(initialEmpCode);
  }, [initialEmpCode]);

  useEffect(() => {
    const loadEmps = async () => {
      try {
        const res = await apiFetch('/api/catalogs/employees');
        const active = (res || []).filter((e) => e.is_active);
        setEmployees(active);
        if (!empCode && active.length > 0) {
          setEmpCode(active[0].emp_code);
        }
      } catch (err) {
        notify(err.message, 'error');
      }
    };
    loadEmps();
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      try {
        if (tab === 'payslip' && empCode) {
          const res = await apiFetch(`/api/payroll/payslip/${empCode}?period_code=${encodeURIComponent(selectedPeriod)}`);
          setPayslip(res);
        } else if (tab === 'v2') {
          const res = await apiFetch(`/api/payroll/print-v2?period_code=${encodeURIComponent(selectedPeriod)}`);
          setV2Data(res);
        } else if (tab === 'v3') {
          const res = await apiFetch(`/api/payroll/print-v3?include_open=${includeOpenV3}`);
          setV3Data(res);
        }
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [tab, empCode, selectedPeriod, includeOpenV3]);

  return (
    <div className="space-y-5">
      {/* Thanh điều khiển (ẩn khi in) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">
            KHỐI 3 & KHỐI 4 · BIỂU MẪU IN ẤN A4 CHÍNH THỨC (02/TL-V2 · PHIẾU LƯƠNG · 03/TL-V3)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Trung tâm In ấn Biểu mẫu & Xuất Báo cáo Tài chính</h2>
        </div>

        <SlidingTabs
          items={[
            { id: 'payslip', label: '1. Tìm kiếm, Hồ sơ & Phiếu lương CB', icon: UserCheck },
            { id: 'v2', label: '2. Bảng lương KD V2 (02/TL-V2)', icon: FileText },
            { id: 'v3', label: '3. Thù lao V3 Năm (03/TL-V3)', icon: Award },
          ]}
          value={tab}
          onChange={setTab}
          className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200"
          buttonClassName="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold"
          pillClassName="bg-[#9E1B32] shadow-sm rounded-xl"
          inactiveTextClass="text-slate-700 hover:text-slate-900"
        />
      </div>

      {/* Bộ chọn theo tab (ẩn khi in) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {tab === 'payslip' && (
              <>
                <div className="relative min-w-[230px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={empQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmpQuery(val);
                      const ql = val.trim().toLowerCase();
                      if (ql) {
                        const first = employees.find((emp) =>
                          `${emp.emp_code} ${emp.full_name} ${emp.title} ${emp.department}`.toLowerCase().includes(ql)
                        );
                        if (first) setEmpCode(first.emp_code);
                      }
                    }}
                    placeholder="Tìm tên, mã CB, chức danh..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
                  />
                </div>
                <select
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white outline-none focus:border-[#9E1B32]"
                >
                  {employees
                    .filter((emp) =>
                      !empQuery.trim() ||
                      `${emp.emp_code} ${emp.full_name} ${emp.title} ${emp.department}`.toLowerCase().includes(empQuery.trim().toLowerCase())
                    )
                    .map((e) => (
                      <option key={e.emp_code} value={e.emp_code}>
                        {e.full_name} ({e.emp_code}) — {e.title}
                      </option>
                    ))}
                </select>
                <SlidingTabs
                  items={[
                    { id: 'slip', label: 'Phiếu lương Kỳ (A4)', activeTextClass: 'text-[#9E1B32]' },
                    { id: 'full_profile', label: 'Hồ sơ Đầy đủ & 12T/V3 (A4)', activeTextClass: 'text-[#9E1B32]' },
                  ]}
                  value={profileMode}
                  onChange={setProfileMode}
                  className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs"
                  buttonClassName="px-2.5 py-1.5 rounded-lg font-bold text-xs"
                  pillClassName="bg-white shadow-sm rounded-lg"
                />
              </>
            )}
            {tab === 'v3' && (
              <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOpenV3}
                  onChange={(e) => setIncludeOpenV3(e.target.checked)}
                  className="accent-[#9E1B32]"
                />
                Bao gồm kỳ ĐANG MỞ trong quyết toán V3
              </label>
            )}
            {tab === 'v2' && (
              <span className="text-xs font-semibold text-slate-600">
                Mẫu chuẩn Agribank <strong>02/TL-V2</strong> — Chi trả tự động mọi cán bộ trong kỳ (không giới hạn 13 dòng).
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => apiDownload(`/api/payroll/export-excel?period_code=${selectedPeriod}&include_open_in_v3=${includeOpenV3}`, `BaoCao_3P_${selectedPeriod}.xlsx`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" /> Xuất Excel Tổng hợp
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" /> In Khổ A4 / Xuất PDF
            </button>
          </div>
        </div>

        {tab === 'payslip' && empQuery.trim() && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-semibold mr-1">Kết quả khớp:</span>
            {employees
              .filter((emp) => `${emp.emp_code} ${emp.full_name} ${emp.title} ${emp.department}`.toLowerCase().includes(empQuery.trim().toLowerCase()))
              .slice(0, 8)
              .map((emp) => (
                <button
                  key={emp.emp_code}
                  type="button"
                  onClick={() => setEmpCode(emp.emp_code)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${
                    emp.emp_code === empCode
                      ? 'bg-[#9E1B32] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {emp.full_name} ({emp.emp_code})
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Khổ giấy A4 in */}
      <div ref={reportStageRef}>
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Đang chuẩn bị biểu mẫu A4...</div>
      ) : tab === 'payslip' && payslip ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-4xl mx-auto print:shadow-none print:border-0 print:p-0">
          {/* Header A4 */}
          <div className="flex flex-col sm:flex-row sm:justify-between border-b-2 border-[#9E1B32] pb-4 mb-5 gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-[#9E1B32]">AGRIBANK · {payslip.org_name}</div>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1">PHIẾU THÔNG BÁO TIỀN LƯƠNG & KẾT QUẢ KPI 3P</h3>
              <div className="text-xs text-slate-500 mt-0.5">Kỳ đánh giá: <strong>{payslip.period_name}</strong> · Ngày công chuẩn: {payslip.standard_workdays} ngày</div>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-600">
              <div>Mã CB: <strong className="font-mono text-slate-900">{payslip.employee.emp_code}</strong></div>
              <div>Họ tên: <strong className="text-slate-900">{payslip.employee.full_name}</strong></div>
              <div>{payslip.employee.title} · {payslip.employee.department}</div>
              <div>{payslip.employee.group_name} ({payslip.employee.labor_type})</div>
            </div>
          </div>

          {payslip.payroll && payslip.kpi ? (
            <div className="space-y-5">
              {/* Tổng kết 3 trụ cột */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Chuyên môn (P1+P3)</div>
                  <div className="text-lg font-extrabold text-sky-700">{fmtNum(payslip.kpi.cm_score, 1)}đ</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">KPI Kinh doanh (P2)</div>
                  <div className="text-lg font-extrabold text-emerald-700">{fmtNum(payslip.kpi.kpi_score, 2)}đ</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Điểm Công việc</div>
                  <div className="text-lg font-extrabold text-slate-900">{fmtNum(payslip.kpi.work_score, 2)}đ</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Hệ số TCV / Loại</div>
                  <div className="text-base font-extrabold text-[#9E1B32]">
                    {(payslip.kpi.tcv * 100).toFixed(1)}% ({payslip.kpi.rating})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-bold text-emerald-800">THỰC NHẬN KỲ</div>
                  <div className="text-base font-extrabold text-emerald-900">{fmtMoney(payslip.payroll.takehome)} đ</div>
                </div>
              </div>

              {/* Chi tiết thu nhập */}
              <table className="w-full text-xs sm:text-sm border border-slate-200">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    <th className="px-3 py-2 border-b border-slate-200 text-left">Khoản mục thu nhập / Chỉ tiêu tính lương</th>
                    <th className="px-3 py-2 border-b border-slate-200 text-right">Định mức / Gốc</th>
                    <th className="px-3 py-2 border-b border-slate-200 text-right">Thực hưởng / Áp dụng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 py-2">Ngày công thực tế / Ngày công chuẩn</td>
                    <td className="px-3 py-2 text-right tabular-nums">{payslip.payroll.standard_workdays} ngày</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(payslip.payroll.actual_workdays, 1)} ngày ({(payslip.payroll.workday_ratio * 100).toFixed(1)}%)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Lương Vị trí & Chức danh (V1)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(payslip.payroll.base_v1)} đ</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-sky-700">{fmtMoney(payslip.payroll.v1_actual)} đ</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Lương Kinh doanh hiệu quả (V2 = ĐM V2 × TCV)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(payslip.payroll.base_v2)} đ</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-[#9E1B32]">{fmtMoney(payslip.payroll.v2_adj)} đ</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Tổng lương cơ bản theo KPI (V1 + V2)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(payslip.payroll.total_before)} đ</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtMoney(payslip.payroll.total_after)} đ</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Quỹ Năng suất chất lượng (NSi) & Chênh lệch</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(payslip.payroll.nsi)} đ</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{payslip.payroll.diff_ns > 0 ? `+${fmtMoney(payslip.payroll.diff_ns)}` : fmtMoney(payslip.payroll.diff_ns)} đ</td>
                  </tr>
                  <tr className="bg-emerald-50 font-extrabold">
                    <td colSpan={2} className="px-3 py-2.5 text-emerald-900">TỔNG TIỀN LƯƠNG THỰC NHẬN TRONG KỲ:</td>
                    <td className="px-3 py-2.5 text-right text-emerald-900 tabular-nums">{fmtMoney(payslip.payroll.takehome)} đ</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-xs italic text-slate-700">
                Bằng chữ: <span className="font-bold">{payslip.takehome_in_words}</span>
              </div>

              {/* 8 chỉ tiêu GK */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Chi tiết 8 Chỉ tiêu Giao khoán P2 trong kỳ</h4>
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2.5 py-2 border-b text-left">Chỉ tiêu</th>
                      <th className="px-2.5 py-2 border-b text-center">Nhánh</th>
                      <th className="px-2.5 py-2 border-b text-right">Mục tiêu Ti</th>
                      <th className="px-2.5 py-2 border-b text-right">Thực hiện Ai</th>
                      <th className="px-2.5 py-2 border-b text-right">Tỷ lệ Ci</th>
                      <th className="px-2.5 py-2 border-b text-right">Điểm Si</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(payslip.targets || []).map((t) => (
                      <tr key={t.indicator_code}>
                        <td className="px-2.5 py-1.5 font-medium">{t.indicator_name}</td>
                        <td className="px-2.5 py-1.5 text-center">{t.kpi_branch}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(t.target_value, 2)}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">{fmtNum(t.actual_value, 2)}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{(t.ratio_ci * 100).toFixed(1)}%</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums font-bold">{fmtNum(t.score_si, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vi phạm trong kỳ (nếu có) */}
              {(payslip.violations_period || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-rose-700 mb-2">Biên bản Vi phạm phát sinh trong kỳ</h4>
                  <table className="w-full text-xs border border-rose-200">
                    <thead className="bg-rose-50 text-rose-900">
                      <tr>
                        <th className="px-2.5 py-1.5 border-b text-left">Mã BB</th>
                        <th className="px-2.5 py-1.5 border-b text-left">Mã lỗi</th>
                        <th className="px-2.5 py-1.5 border-b text-left">Chi tiết</th>
                        <th className="px-2.5 py-1.5 border-b text-right">Điểm trừ CB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {payslip.violations_period.map((v) => (
                        <tr key={v.record_code}>
                          <td className="px-2.5 py-1.5 font-mono font-bold">{v.record_code}</td>
                          <td className="px-2.5 py-1.5 font-mono">{v.error_code}</td>
                          <td className="px-2.5 py-1.5">{v.error_detail}</td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-rose-700">-{fmtNum(v.emp_deduction, 1)}đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Hồ sơ tổng hợp 12 tháng & V3 nếu chọn chế độ full_profile */}
              {profileMode === 'full_profile' && payslip.accumulation && (
                <div className="space-y-4 pt-3 border-t-2 border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">Hồ sơ Định mức & Thù lao Năm 2026 (TichLuy_V3)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">HSL V1 / Lương V1 ĐM</div>
                        <div className="font-bold">{fmtNum(payslip.employee.hsl_v1, 2)} · {fmtMoney(payslip.employee.base_v1)} đ</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">Lương V2 ĐM / Vai trò</div>
                        <div className="font-bold">{fmtMoney(payslip.employee.base_v2)} đ {payslip.employee.is_ksv ? '· KSV' : ''}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">KPI BQ Năm / Xếp loại</div>
                        <div className="font-bold">{fmtNum(payslip.accumulation.year.kpi_bq, 2)}đ · {payslip.accumulation.year.rating} (H3={fmtNum(payslip.accumulation.year.h3, 2)})</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                        <div className="text-rose-700 font-semibold">Dự kiến Thù lao V3 năm</div>
                        <div className="font-extrabold text-[#9E1B32]">{fmtMoney(payslip.accumulation.year.v3_amount)} đ</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Lũy kế 4 Quý (Q1–Q4) & 12 Tháng</h4>
                    <table className="w-full text-xs border border-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-2.5 py-1.5 border-b text-left">Quý</th>
                          <th className="px-2.5 py-1.5 border-b text-right">KPI BQ</th>
                          <th className="px-2.5 py-1.5 border-b text-center">Xếp loại</th>
                          <th className="px-2.5 py-1.5 border-b text-right">Ngày công</th>
                          <th className="px-2.5 py-1.5 border-b text-right">V2 Quyết toán</th>
                          <th className="px-2.5 py-1.5 border-b text-right">V2 Đã lĩnh</th>
                          <th className="px-2.5 py-1.5 border-b text-right">Bổ sung V2</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                          const qd = payslip.accumulation.quarters[q];
                          return (
                            <tr key={q}>
                              <td className="px-2.5 py-1.5 font-bold">Quý {q.replace('Q', '')}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(qd.kpi_bq, 2)}</td>
                              <td className="px-2.5 py-1.5 text-center font-bold">{qd.rating}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(qd.workdays, 1)}/{qd.std_days}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMoney(qd.v2_qt)} đ</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMoney(qd.v2_paid)} đ</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-[#9E1B32]">+{fmtMoney(qd.v2_bonus)} đ</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm">Cán bộ này chưa có số liệu trong kỳ {payslip.period_name}.</div>
          )}
        </div>
      ) : tab === 'v2' && v2Data ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-0 print:p-0">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-5 text-xs">
            <div>
              <div className="font-bold uppercase text-[#9E1B32]">NGÂN HÀNG NÔNG NGHIỆP VÀ PTNT VIỆT NAM</div>
              <div className="font-bold uppercase">{v2Data.org_name} · {v2Data.unit_name}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">Biểu mẫu: 02/TL-V2</div>
              <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="underline">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>

          <div className="text-center mb-5">
            <h3 className="text-lg font-extrabold uppercase text-slate-900">BẢNG THANH TOÁN TIỀN LƯƠNG KINH DOANH (V2) & THU NHẬP 3P</h3>
            <div className="text-xs text-slate-600 font-semibold mt-0.5">{v2Data.period_name}</div>
          </div>

          <table className="w-full text-xs border border-slate-300">
            <thead className="bg-slate-100 text-slate-900">
              <tr>
                <th className="px-2 py-2 border border-slate-300 text-center">STT</th>
                <th className="px-2 py-2 border border-slate-300 text-left">Họ và tên</th>
                <th className="px-2 py-2 border border-slate-300 text-left">Chức danh</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Lương V2 ĐM</th>
                <th className="px-2 py-2 border border-slate-300 text-center">Loại KPI</th>
                <th className="px-2 py-2 border border-slate-300 text-right">TCV</th>
                <th className="px-2 py-2 border border-slate-300 text-right">V2 Thực hưởng</th>
                <th className="px-2 py-2 border-slate-300 text-right">V1 Thực lĩnh</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Tổng thực nhận</th>
                <th className="px-2 py-2 border border-slate-300 text-center">Ký nhận</th>
              </tr>
            </thead>
            <tbody>
              {(v2Data.rows || []).map((r, i) => (
                <tr key={r.emp_code}>
                  <td className="px-2 py-1.5 border border-slate-300 text-center">{i + 1}</td>
                  <td className="px-2 py-1.5 border border-slate-300 font-bold">{r.full_name}</td>
                  <td className="px-2 py-1.5 border border-slate-300">{r.title}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{fmtMoney(r.base_v2)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-center font-bold">{r.rating}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{(r.tcv * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums font-bold">{fmtMoney(r.v2_adj)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{fmtMoney(r.v1_actual)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums font-bold">{fmtMoney(r.takehome)}</td>
                  <td className="px-2 py-1.5 border border-slate-300"></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <td colSpan={3} className="px-2 py-2 border border-slate-300 text-center">TỔNG CỘNG ({v2Data.rows?.length || 0} người)</td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums">{fmtMoney(v2Data.totals?.base_v2)}</td>
                <td colSpan={2} className="px-2 py-2 border border-slate-300"></td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums text-[#9E1B32]">{fmtMoney(v2Data.totals?.v2_adj)}</td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums">{fmtMoney(v2Data.totals?.v1_actual)}</td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums">{fmtMoney(v2Data.totals?.takehome)}</td>
                <td className="px-2 py-2 border border-slate-300"></td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-4 text-xs">
            <div>Tổng số tiền V2 bằng chữ: <strong className="italic">{v2Data.totals?.v2_adj_in_words}</strong></div>
            <div>Tổng thực nhận 3P bằng chữ: <strong className="italic">{v2Data.totals?.takehome_in_words}</strong></div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center text-xs mt-8 pt-2">
            <div><div className="font-bold uppercase">Người lập biểu</div><div className="text-slate-400 italic mt-12">(Ký, ghi rõ họ tên)</div></div>
            <div><div className="font-bold uppercase">Kế toán trưởng</div><div className="text-slate-400 italic mt-12">(Ký, ghi rõ họ tên)</div></div>
            <div><div className="font-bold uppercase">Giám đốc Chi nhánh</div><div className="text-slate-400 italic mt-12">(Ký tên, đóng dấu)</div></div>
          </div>
        </div>
      ) : tab === 'v3' && v3Data ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-0 print:p-0">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-5 text-xs">
            <div>
              <div className="font-bold uppercase text-[#9E1B32]">NGÂN HÀNG NÔNG NGHIỆP VÀ PTNT VIỆT NAM</div>
              <div className="font-bold uppercase">{v3Data.org_name} · {v3Data.unit_name}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">Biểu mẫu: 03/TL-V3</div>
              <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="underline">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>

          <div className="text-center mb-5">
            <h3 className="text-lg font-extrabold uppercase text-slate-900">BẢNG QUYẾT TOÁN QUỸ THÙ LAO V3 NĂM {v3Data.year_num}</h3>
            <div className="text-xs text-slate-600 mt-0.5">
              Phương pháp phân bổ: <strong>{v3Data.v3_allocation_method}</strong> {v3Data.include_open ? '(Đã gồm kỳ đang mở)' : '(Chỉ tính các kỳ đã khóa sổ)'}
            </div>
          </div>

          <table className="w-full text-xs border border-slate-300">
            <thead className="bg-slate-100 text-slate-900">
              <tr>
                <th className="px-2 py-2 border border-slate-300 text-center">STT</th>
                <th className="px-2 py-2 border border-slate-300 text-left">Họ và tên</th>
                <th className="px-2 py-2 border border-slate-300 text-left">Chức danh</th>
                <th className="px-2 py-2 border border-slate-300 text-right">KPI BQ</th>
                <th className="px-2 py-2 border border-slate-300 text-center">Hạng / H3</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Công năm</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Bổ sung V2</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Hệ số phân bổ</th>
                <th className="px-2 py-2 border border-slate-300 text-right">Thù lao V3 được hưởng</th>
                <th className="px-2 py-2 border border-slate-300 text-center">Ký nhận</th>
              </tr>
            </thead>
            <tbody>
              {(v3Data.rows || []).map((r, i) => (
                <tr key={r.emp_code}>
                  <td className="px-2 py-1.5 border border-slate-300 text-center">{i + 1}</td>
                  <td className="px-2 py-1.5 border border-slate-300 font-bold">{r.full_name}</td>
                  <td className="px-2 py-1.5 border border-slate-300">{r.title}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{fmtNum(r.year.kpi_bq, 2)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-center font-bold">{r.year.rating} ({fmtNum(r.year.h3, 2)})</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{fmtNum(r.year.workdays, 1)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{fmtMoney(r.year.v2_bonus_final)}</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums">{(r.year.v3_ratio * 100).toFixed(2)}%</td>
                  <td className="px-2 py-1.5 border border-slate-300 text-right tabular-nums font-bold text-[#9E1B32]">{fmtMoney(r.year.v3_amount)}</td>
                  <td className="px-2 py-1.5 border border-slate-300"></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <td colSpan={6} className="px-2 py-2 border border-slate-300 text-center">TỔNG CỘNG QUYẾT TOÁN ({v3Data.rows?.length || 0} người)</td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums">{fmtMoney(v3Data.totals?.v2_bonus_final)}</td>
                <td className="px-2 py-2 border border-slate-300 text-right">100.00%</td>
                <td className="px-2 py-2 border border-slate-300 text-right tabular-nums text-[#9E1B32]">{fmtMoney(v3Data.totals?.v3_amount)}</td>
                <td className="px-2 py-2 border border-slate-300"></td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-4 text-xs">
            Tổng quỹ Thù lao V3 bằng chữ: <strong className="italic">{v3Data.totals?.v3_in_words}</strong>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center text-xs mt-8 pt-2">
            <div><div className="font-bold uppercase">Người lập biểu</div><div className="text-slate-400 italic mt-12">(Ký, ghi rõ họ tên)</div></div>
            <div><div className="font-bold uppercase">Kế toán trưởng</div><div className="text-slate-400 italic mt-12">(Ký, ghi rõ họ tên)</div></div>
            <div><div className="font-bold uppercase">Giám đốc Chi nhánh</div><div className="text-slate-400 italic mt-12">(Ký tên, đóng dấu)</div></div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

