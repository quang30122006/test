import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum, ksvStatusBadge } from '../utils/format';
import { ShieldCheck, Check, X, CheckCheck, XCircle, AlertCircle } from 'lucide-react';

export default function KsvQueueView({ selectedPeriod, periods, notify, onReloadKsv }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ pending_count: 0, approved_count: 0, rejected_count: 0, total_ksv_applied: 0 });
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/operations/violations?period_code=${encodeURIComponent(selectedPeriod)}`);
      setItems((data.items || []).filter((x) => x.has_ksv_resp));
      setSummary(data.ksv_summary || { pending_count: 0, approved_count: 0, rejected_count: 0, total_ksv_applied: 0 });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const handleReview = async (recordCode, decision) => {
    try {
      const res = await apiFetch(`/api/operations/violations/${recordCode}/ksv-review`, {
        method: 'POST',
        body: JSON.stringify({ decision, ksv_note: notes[recordCode] || '' }),
      });
      notify(res.message || `Đã cập nhật ${recordCode}`);
      load();
      if (onReloadKsv) onReloadKsv();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleBulk = async (decision) => {
    const label = decision === 'APPROVED' ? 'CHẤP NHẬN TẤT CẢ' : 'TỪ CHỐI TẤT CẢ';
    if (!window.confirm(`Xác nhận ${label} toàn bộ phiếu KSV trong kỳ ${curPeriod?.period_name || selectedPeriod}?`)) return;
    try {
      const res = await apiFetch(`/api/operations/violations/ksv-bulk-review?decision=${decision}&period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'POST',
      });
      notify(res.message || 'Đã xử lý hàng loạt');
      load();
      if (onReloadKsv) onReloadKsv();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.7 · HÀNG CHỜ KIỂM SOÁT VIÊN PHÊ DUYỆT (KSV_ChoDuyet)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Thẩm duyệt trách nhiệm liên đới KSV — {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Mặc định điểm đề xuất liên đới KSV chỉ được tính vào Điểm trừ KSV tháng khi Kiểm soát viên hoặc Quản trị bấm <strong>Chấp nhận (APPROVED)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBulk('APPROVED')}
            disabled={isLocked || items.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" /> Chấp nhận tất cả
          </button>
          <button
            onClick={() => handleBulk('REJECTED')}
            disabled={isLocked || items.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-4 h-4" /> Từ chối tất cả
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Không thể thay đổi quyết định KSV.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-bold text-amber-800">Đang chờ duyệt (PENDING)</div>
          <div className="text-2xl font-extrabold text-amber-900 mt-1">{summary.pending_count}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-bold text-emerald-800">Đã chấp nhận (APPROVED)</div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">{summary.approved_count}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="text-xs font-bold text-rose-800">Đã từ chối (REJECTED)</div>
          <div className="text-2xl font-extrabold text-rose-900 mt-1">{summary.rejected_count}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-600">Tổng điểm KSV đã áp dụng</div>
          <div className="text-2xl font-extrabold text-[#9E1B32] mt-1">-{fmtNum(summary.total_ksv_applied, 1)}đ</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Mã BB</th>
                <th className="px-3 py-3">Cán bộ vi phạm & Lỗi</th>
                <th className="px-3 py-3">KSV liên đới</th>
                <th className="px-3 py-3 text-right">Điểm đề xuất</th>
                <th className="px-3 py-3 text-right">Điểm áp dụng</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Ý kiến giải trình / Ghi chú</th>
                <th className="px-3 py-3 text-center">Quyết định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">Đang tải hàng chờ KSV...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Kỳ này chưa có phiếu liên đới Kiểm soát viên nào.
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const st = ksvStatusBadge(r.ksv_status);
                  return (
                    <tr key={r.record_code} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        <div>{r.record_code}</div>
                        <div className="text-[11px] font-sans font-normal text-slate-400">{r.created_date}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <div className="font-bold text-slate-900">{r.emp_name} · <span className="font-mono text-rose-700">{r.error_code}</span></div>
                        <div className="text-xs text-slate-500 line-clamp-2">{r.error_detail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{r.ksv_emp_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.ksv_emp_code}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-amber-700">
                        -{fmtNum(r.ksv_proposed_points, 1)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-[#9E1B32]">
                        -{fmtNum(r.ksv_applied_points, 1)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {r.ksv_reviewed_at && <div className="text-[10px] text-slate-400 mt-0.5">{r.ksv_reviewed_at}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={notes[r.record_code] ?? r.ksv_note ?? ''}
                          onChange={(e) => setNotes({ ...notes, [r.record_code]: e.target.value })}
                          placeholder="Ghi chú duyệt/từ chối..."
                          className="w-48 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#9E1B32]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLocked ? (
                          '—'
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleReview(r.record_code, 'APPROVED')}
                              title="Chấp nhận trừ KSV"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Duyệt
                            </button>
                            <button
                              onClick={() => handleReview(r.record_code, 'REJECTED')}
                              title="Từ chối liên đới"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> Từ chối
                            </button>
                          </div>
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

