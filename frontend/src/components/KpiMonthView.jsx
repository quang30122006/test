import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum, ratingBadgeClass } from '../utils/format';
import { Save, Award, AlertCircle, SlidersHorizontal } from 'lucide-react';

export default function KpiMonthView({ selectedPeriod, periods, onNavigate, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editCode, setEditCode] = useState(null);
  const [draft, setDraft] = useState({ priority_points: 0, note: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payroll/kpi-month?period_code=${encodeURIComponent(selectedPeriod)}`);
      setData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const savePriority = async (empCode) => {
    try {
      await apiFetch('/api/payroll/kpi-month/priority', {
        method: 'PUT',
        body: JSON.stringify({
          period_code: selectedPeriod,
          emp_code: empCode,
          priority_points: Number(draft.priority_points || 0),
          note: draft.note || '',
        }),
      });
      notify(`Đã cập nhật điểm cộng ưu tiên cho ${empCode}`);
      setEditCode(null);
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const rows = data?.rows || [];
  const cfg = data?.config_effective || {};

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            KHỐI 3 · MỤC 3.1 · BẢNG ĐÁNH GIÁ KPI 3 TRỤ CỘT (KPI_Thang)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Tổng hợp Điểm Chuyên môn (P1+P3) · KPI Kinh doanh (P2) · Xếp loại — {data?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Trọng số áp dụng: CM = <strong>{((cfg.w_cm ?? 0.75) * 100).toFixed(0)}%</strong> · KPI = <strong>{((cfg.w_kpi ?? 0.25) * 100).toFixed(0)}%</strong> · Dự phòng = <strong>{((cfg.w_reserve ?? 0) * 100).toFixed(0)}%</strong> · Giới hạn trần TCV = <strong>{((cfg.tcv_max_cap ?? 1.0) * 100).toFixed(0)}%</strong>.
          </p>
        </div>

        <button
          onClick={() => onNavigate('formula_studio')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold cursor-pointer self-start"
        >
          <SlidersHorizontal className="w-4 h-4 text-amber-300" /> Chỉnh công thức
        </button>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Chỉ xem bảng điểm KPI, không chỉnh sửa điểm ưu tiên.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="px-3 py-3">Cán bộ / Phòng</th>
                <th className="px-3 py-3 text-right">Điểm CM</th>
                <th className="px-3 py-3 text-right">Trừ TT</th>
                <th className="px-3 py-3 text-right">Trừ LĐ</th>
                <th className="px-3 py-3 text-right">Trừ KSV</th>
                <th className="px-3 py-3 text-right">HDV</th>
                <th className="px-3 py-3 text-right">DV</th>
                <th className="px-3 py-3 text-right">DN</th>
                <th className="px-3 py-3 text-right">Điểm KPI</th>
                <th className="px-3 py-3 text-right">Công việc</th>
                <th className="px-3 py-3 text-right">Cộng Ưu tiên</th>
                <th className="px-3 py-3 text-right">Hệ số TCV</th>
                <th className="px-3 py-3 text-center">Xếp loại</th>
                <th className="px-3 py-3 text-center">Ưu tiên</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-slate-400">Đang tính toán KPI 3 trụ cột...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-slate-400">
                    <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Chưa có dữ liệu nhân sự trong kỳ này.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isEd = editCode === r.emp_code;
                  return (
                    <tr key={r.emp_code} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{r.full_name}</div>
                        <div className="text-[11px] text-slate-400">{r.title} · {r.labor_type}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-sky-700">{fmtNum(r.cm_score, 1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">{r.direct_deduction > 0 ? `-${fmtNum(r.direct_deduction, 1)}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">{r.joint_deduction > 0 ? `-${fmtNum(r.joint_deduction, 1)}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{r.ksv_deduction > 0 ? `-${fmtNum(r.ksv_deduction, 1)}` : '0'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.pct_hdv, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.pct_dv, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.pct_dn, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">{fmtNum(r.kpi_score, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-slate-900">{fmtNum(r.work_score, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {isEd ? (
                          <div className="space-y-1">
                            <input
                              type="number"
                              step="0.5"
                              value={draft.priority_points}
                              onChange={(e) => setDraft({ ...draft, priority_points: e.target.value })}
                              className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-right"
                            />
                            <input
                              type="text"
                              value={draft.note}
                              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                              placeholder="Lý do..."
                              className="w-28 px-1.5 py-0.5 border border-slate-300 rounded text-[11px]"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className={r.priority_points > 0 ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                              {r.priority_points > 0 ? `+${fmtNum(r.priority_points, 1)}` : '0'}
                            </span>
                            {r.priority_note && <div className="text-[10px] text-slate-400">{r.priority_note}</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-[#9E1B32]">{(r.tcv * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${ratingBadgeClass(r.rating)}`}>
                          {r.rating}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLocked ? (
                          '—'
                        ) : isEd ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => savePriority(r.emp_code)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditCode(null)}
                              className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditCode(r.emp_code);
                              setDraft({ priority_points: r.priority_points || 0, note: r.priority_note || '' });
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                          >
                            + Điểm
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

