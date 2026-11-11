import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum } from '../utils/format';
import { Save, CalendarCheck2, CheckSquare, AlertCircle } from 'lucide-react';

export default function AttendanceView({ selectedPeriod, periods, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [rows, setRows] = useState([]);
  const [stdDays, setStdDays] = useState(22);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/operations/attendance?period_code=${encodeURIComponent(selectedPeriod)}`);
      setRows(data.rows || []);
      setStdDays(data.standard_workdays || 22);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const updateRow = (empCode, field, val) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.emp_code !== empCode) return r;
        const next = { ...r, [field]: val };
        if (field === 'actual_workdays') {
          const aw = Number(val || 0);
          next.workday_ratio = stdDays > 0 ? aw / stdDays : 1;
        }
        return next;
      })
    );
  };

  const fillStandardAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        actual_workdays: stdDays,
        workday_ratio: 1,
      }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        emp_code: r.emp_code,
        actual_workdays: Number(r.actual_workdays || 0),
        note: r.note || '',
      }));
      const res = await apiFetch(`/api/operations/attendance?period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      notify(res.message || 'Đã lưu bảng chấm công');
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalDays = rows.reduce((acc, r) => acc + Number(r.actual_workdays || 0), 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.3 · BẢNG CHẤM CÔNG HÀNG THÁNG (ChamCong)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Chấm công ngày thực tế — {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Công chuẩn kỳ (Kchuẩn): <span className="font-bold text-slate-800">{stdDays} ngày</span>. Ngày công thực tế tự động đồng bộ sang Bảng thanh toán lương 3P (tính Lương V1 thực lĩnh) và Tích lũy V3.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fillStandardAll}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-sky-600" /> Điền đủ công chuẩn ({stdDays}d)
          </button>
          <button
            onClick={handleSave}
            disabled={isLocked || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu bảng chấm công'}
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Không thể sửa ngày công chấm công.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-3 w-12 text-center">STT</th>
                <th className="px-3 py-3">Mã CB</th>
                <th className="px-3 py-3">Họ và tên</th>
                <th className="px-3 py-3">Chức danh / Phòng</th>
                <th className="px-3 py-3 text-right">Công chuẩn (Kchuẩn)</th>
                <th className="px-3 py-3 text-right">Công thực tế (Ktt)</th>
                <th className="px-3 py-3 text-right">Tỷ lệ hưởng công</th>
                <th className="px-3 py-3">Ghi chú chấm công</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">Đang tải...</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.emp_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center text-slate-500">{r.stt}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{r.emp_code}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{r.full_name}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{r.title}</div>
                      <div className="text-[11px] text-slate-400">{r.department}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtNum(stdDays, 1)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="31"
                        disabled={isLocked}
                        value={r.actual_workdays}
                        onChange={(e) => updateRow(r.emp_code, 'actual_workdays', e.target.value)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right font-bold text-[#9E1B32] focus:border-[#9E1B32] outline-none disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.workday_ratio >= 1
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.workday_ratio >= 0.8
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {((r.workday_ratio || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={r.note || ''}
                        onChange={(e) => updateRow(r.emp_code, 'note', e.target.value)}
                        placeholder="Ghi chú (nếu nghỉ phép, bù...)"
                        className="w-full min-w-[160px] px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#9E1B32] disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs sm:text-sm">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-right">TỔNG CỘNG ({rows.length} cán bộ):</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtNum(stdDays * rows.length, 1)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#9E1B32]">{fmtNum(totalDays, 1)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {stdDays * rows.length > 0 ? ((totalDays / (stdDays * rows.length)) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 flex items-center gap-1">
                    <CalendarCheck2 className="w-4 h-4 text-emerald-600" /> Tự động liên kết P3 & V1
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

