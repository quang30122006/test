import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';
import { useGSAP, runReducedMotionAware, animateTabContentEnter } from '../utils/gsapSetup';
import SlidingTabs from './SlidingTabs';
import { Layers, Printer, Save, X, Edit3 } from 'lucide-react';

export default function AccumulationV3View({ onNavigate, notify }) {
  const [data, setData] = useState(null);
  const [includeOpen, setIncludeOpen] = useState(false);
  const [subTab, setSubTab] = useState('year'); // 'months' | 'quarters' | 'year'
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState(null); // { emp_code, full_name, month_num, kpi_score, workdays, v2_paid, v1_paid }
  const tabPanelRef = useRef(null);
  const isFirstTabRef = useRef(true);

  useGSAP(() => {
    if (isFirstTabRef.current) {
      isFirstTabRef.current = false;
      return;
    }
    if (!tabPanelRef.current) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(tabPanelRef.current, { y: 10, duration: 0.28 });
    });
  }, { dependencies: [subTab] });

  const load = async (incOpen = includeOpen) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payroll/tich-luy-v3?year_num=2026&include_open=${incOpen}`);
      setData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(includeOpen);
  }, [includeOpen]);

  const saveHistoryCell = async (e) => {
    e.preventDefault();
    if (!editCell) return;
    try {
      await apiFetch('/api/payroll/tich-luy-v3/cell', {
        method: 'PUT',
        body: JSON.stringify({
          year_num: data?.year_num || 2026,
          month_num: Number(editCell.month_num),
          emp_code: editCell.emp_code,
          kpi_score: editCell.kpi_score === '' ? null : Number(editCell.kpi_score),
          workdays: editCell.workdays === '' ? null : Number(editCell.workdays),
          v2_paid: editCell.v2_paid === '' ? null : Number(editCell.v2_paid),
          v1_paid: editCell.v1_paid === '' ? null : Number(editCell.v1_paid),
        }),
      });
      notify(`Đã cập nhật dữ liệu T${editCell.month_num} của ${editCell.full_name}`);
      setEditCell(null);
      load(includeOpen);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            KHỐI 3 · MỤC 3.3 · TÍCH LŨY V2 12 THÁNG & QUYẾT TOÁN QUỸ THÙ LAO V3 (TichLuy_V3)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Theo dõi Lũy kế 12 tháng · Quyết toán Quý Q1–Q4 · Quỹ Thù lao V3 Năm {data?.year_num || 2026}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Phương pháp chia V3: <span className="font-bold text-slate-800">{data?.v3_allocation_method}</span> · Quỹ V3 năm: <span className="font-bold text-[#9E1B32]">{fmtMoney(data?.v3_fund)} đ</span> · Khớp cân đối quỹ 100% không dùng ô gán tay sai lệch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => setIncludeOpen(e.target.checked)}
              className="accent-[#9E1B32]"
            />
            Tính dự kiến cả Kỳ ĐANG MỞ (What-If/T10)
          </label>

          <button
            onClick={() => onNavigate('print_reports', { tab: 'v3' })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> In Bảng V3 (03/TL-V3)
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">V2 Quyết toán Cả năm</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">{fmtMoney(totals.v2_qt)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">V2 Đã lĩnh (Tháng + Quý)</div>
          <div className="text-lg sm:text-xl font-extrabold text-sky-700 mt-1">{fmtMoney(totals.v2_received)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">Bổ sung V2 cuối năm</div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1">{fmtMoney(totals.v2_bonus_final)} đ</div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
          <div className="text-xs text-[#9E1B32] font-bold">Tổng Quỹ Thù lao V3 phân bổ</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#9E1B32] mt-1">{fmtMoney(totals.v3_amount)} đ</div>
        </div>
      </div>

      {/* Sub-navigation */}
      <SlidingTabs
        items={[
          { id: 'year', label: '1. Quyết toán Năm & Thù lao V3' },
          { id: 'quarters', label: '2. Quyết toán 4 Quý (Q1–Q4)' },
          { id: 'months', label: '3. Chi tiết 12 Tháng (Chỉnh sửa lịch sử)' },
        ]}
        value={subTab}
        onChange={setSubTab}
        className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit"
        buttonClassName="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold"
        pillClassName="bg-[#9E1B32] shadow-sm rounded-xl"
      />

      <div ref={tabPanelRef}>
      {/* Tab 1: Quyết toán Năm & V3 */}
      {subTab === 'year' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="px-3 py-3">Cán bộ</th>
                  <th className="px-3 py-3 text-right">KPI BQ Năm</th>
                  <th className="px-3 py-3 text-center">Loại</th>
                  <th className="px-3 py-3 text-right">Kq / H3</th>
                  <th className="px-3 py-3 text-right">Công tích lũy</th>
                  <th className="px-3 py-3 text-right">V2 QT Năm</th>
                  <th className="px-3 py-3 text-right">V2 Đã lĩnh</th>
                  <th className="px-3 py-3 text-right">Bổ sung V2</th>
                  <th className="px-3 py-3 text-right">V1 Năm</th>
                  <th className="px-3 py-3 text-right">Tỷ trọng V3</th>
                  <th className="px-3 py-3 text-right bg-[#9E1B32]">Thù lao V3</th>
                  <th className="px-3 py-3">Trạng thái quỹ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-400">Đang tổng hợp tích lũy V3...</td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const y = r.year;
                    return (
                      <tr key={r.emp_code} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{r.full_name}</div>
                          <div className="text-[11px] text-slate-400">{r.title}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmtNum(y.kpi_bq, 2)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${ratingBadgeClass(y.rating)}`}>
                            {y.rating}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {fmtNum(y.kq, 2)} / {fmtNum(y.h3, 2)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {fmtNum(y.workdays, 1)} <span className="text-slate-400">({y.months_active}T)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtMoney(y.v2_qt)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-sky-700 font-semibold">{fmtMoney(y.v2_received)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-bold">{fmtMoney(y.v2_bonus_final)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(y.v1_total)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{(y.v3_ratio * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-[#9E1B32] bg-rose-50/50">
                          {fmtMoney(y.v3_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600">{y.status_note}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right">TỔNG CỘNG QUYẾT TOÁN NĂM:</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.v2_qt)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-sky-800">{fmtMoney(totals.v2_received)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-800">{fmtMoney(totals.v2_bonus_final)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.v1_total)}</td>
                    <td className="px-3 py-3 text-right">100.00%</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#9E1B32] bg-rose-100">{fmtMoney(totals.v3_amount)}</td>
                    <td className="px-3 py-3 text-xs text-emerald-700">Khớp Quỹ V3 100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: 4 Quý Q1-Q4 */}
      {subTab === 'quarters' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="px-3 py-3" rowSpan={2}>Cán bộ</th>
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                    <th key={q} colSpan={3} className="px-3 py-2 text-center border-l border-slate-700">
                      QUÝ {q.replace('Q', '')}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-800">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                    <React.Fragment key={q}>
                      <th className="px-2 py-2 text-right border-l border-slate-700">KPI / Loại</th>
                      <th className="px-2 py-2 text-right">V2 QT / Đã lĩnh</th>
                      <th className="px-2 py-2 text-right text-amber-300">BS V2 {q}</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.emp_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{r.full_name}</td>
                    {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                      const qd = r.quarters[q];
                      return (
                        <React.Fragment key={q}>
                          <td className="px-2 py-2 text-right border-l border-slate-100 tabular-nums">
                            <div>{fmtNum(qd.kpi_bq, 1)}</div>
                            <span className={`inline-block px-1.5 rounded text-[10px] font-bold ${ratingBadgeClass(qd.rating)}`}>
                              {qd.rating}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            <div className="font-semibold text-slate-700">{fmtMoney(qd.v2_qt)}</div>
                            <div className="text-[11px] text-slate-400">{fmtMoney(qd.v2_paid)}</div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums font-bold text-[#9E1B32]">
                            {fmtMoney(qd.v2_bonus)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Lịch sử 12 tháng + cho phép chỉnh ô */}
      {subTab === 'months' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#9E1B32]" />
            Nhấp vào bất kỳ ô tháng nào (KPI / Công / V2 đã lĩnh) để hiệu chỉnh số liệu lịch sử (ghi nhận ngay vào Nhật ký kiểm toán).
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-900 text-white uppercase">
                <tr>
                  <th className="px-3 py-3 sticky left-0 bg-slate-900 z-10">Cán bộ</th>
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                    <th key={m} className="px-2.5 py-3 text-center min-w-[95px]">
                      Tháng {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.emp_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900 sticky left-0 bg-white border-r border-slate-200 whitespace-nowrap">
                      {r.full_name}
                    </td>
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => {
                      const md = r.months[m] || {};
                      const hasData = md.kpi_score !== null && md.kpi_score !== undefined;
                      return (
                        <td
                          key={m}
                          onClick={() =>
                            setEditCell({
                              emp_code: r.emp_code,
                              full_name: r.full_name,
                              month_num: m,
                              kpi_score: md.kpi_score ?? '',
                              workdays: md.workdays ?? '',
                              v2_paid: md.v2_paid ?? '',
                              v1_paid: md.v1_paid ?? '',
                            })
                          }
                          className="px-2 py-2 text-right cursor-pointer hover:bg-rose-50 transition border-l border-slate-100 group"
                          title="Nhấp để sửa ô lịch sử tháng này"
                        >
                          {hasData ? (
                            <div className="space-y-0.5 tabular-nums">
                              <div className="font-bold text-slate-900 flex items-center justify-end gap-1">
                                {fmtNum(md.kpi_score, 1)}đ
                                <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#9E1B32]" />
                              </div>
                              <div className="text-[10px] text-slate-500">{fmtNum(md.workdays, 1)}d</div>
                              <div className="text-[10px] font-semibold text-[#9E1B32]">{fmtMoney(md.v2_paid)}</div>
                              {!md.is_frozen && <div className="text-[9px] text-amber-600 font-bold">Dự kiến</div>}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Modal sửa ô lịch sử tháng */}
      {editCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="font-bold text-sm">
                Điều chỉnh Tích lũy Tháng {editCell.month_num} — {editCell.full_name}
              </div>
              <button onClick={() => setEditCell(null)} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveHistoryCell} className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Điểm KPI Tháng</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCell.kpi_score}
                    onChange={(e) => setEditCell({ ...editCell, kpi_score: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày công thực tế</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editCell.workdays}
                    onChange={(e) => setEditCell({ ...editCell, workdays: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lương V2 đã lĩnh (đ)</label>
                  <input
                    type="number"
                    step="1"
                    value={editCell.v2_paid}
                    onChange={(e) => setEditCell({ ...editCell, v2_paid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lương V1 thực lĩnh (đ)</label>
                  <input
                    type="number"
                    step="1"
                    value={editCell.v1_paid}
                    onChange={(e) => setEditCell({ ...editCell, v1_paid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCell(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Lưu số liệu lịch sử
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

