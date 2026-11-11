import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock, ArrowRightLeft, Save, Trash2, CalendarDays } from 'lucide-react';
import { apiFetch } from '../api';
import { periodStatusBadge } from '../utils/format';
import ClearMonthDataModal from './ClearMonthDataModal';

export default function PeriodManagerView({ periods, currentPeriodCode, onRefreshPeriods, onSelectPeriod, notify }) {
  const [editing, setEditing] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [summaryMap, setSummaryMap] = useState({});
  const [clearModalPeriod, setClearModalPeriod] = useState(null);

  const totalYearDays = periods.reduce((acc, p) => acc + Number(p.standard_days || 0), 0);

  const loadSummary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/periods/data-summary');
      const map = {};
      (res.periods || []).forEach((item) => {
        map[item.period_code] = item;
      });
      setSummaryMap(map);
    } catch {
      // bỏ qua nếu tạm thời chưa lấy được thống kê dòng
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, periods]);

  const handleAction = async (fn) => {
    setErr('');
    setMsg('');
    try {
      const res = await fn();
      if (res?.message) setMsg(res.message);
      await onRefreshPeriods();
      await loadSummary();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleSavePeriod = async (p) => {
    const ed = editing[p.period_code] || {};
    await handleAction(() =>
      apiFetch(`/api/admin/periods/${p.period_code}`, {
        method: 'PUT',
        body: JSON.stringify({
          standard_days: ed.standard_days !== undefined ? Number(ed.standard_days) : p.standard_days,
          note: ed.note !== undefined ? ed.note : p.note,
        }),
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#9E1B32]" /> Quản lý 12 Kỳ Tính lương Năm 2026 (TrangThai_Ky)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Mỗi kỳ được lưu trữ dữ liệu tách biệt. Khi <strong>Chốt sổ & Khóa kỳ</strong>, hệ thống tự động đóng băng KPI, Ngày công, V1 thực lĩnh & V2 vào Tích lũy V3.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (window.confirm('Xác nhận CHỐT SỔ & ĐÓNG BĂNG dữ liệu kỳ đang mở vào Tích lũy V3?')) {
                handleAction(() => apiFetch('/api/admin/periods/close-current', { method: 'POST' }));
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold cursor-pointer"
          >
            <Lock className="w-4 h-4" /> Chốt sổ & Khóa kỳ đang mở
          </button>
          <button
            onClick={() => {
              if (window.confirm('Mở kỳ CHƯA MỞ kế tiếp và khởi tạo khung nhân sự/chỉ tiêu sang kỳ mới?')) {
                handleAction(() => apiFetch('/api/admin/periods/open-next?carry_forward_data=true', { method: 'POST' }));
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
          >
            <Unlock className="w-4 h-4" /> Mở kỳ mới kế tiếp
          </button>
          <button
            onClick={() => setClearModalPeriod(currentPeriodCode)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Xóa dữ liệu theo tháng
          </button>
        </div>
      </div>

      {msg && <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">{msg}</div>}
      {err && <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">{err}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Mã kỳ</th>
                <th className="p-3 text-left">Tên kỳ đánh giá</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-center">Ngày chốt sổ</th>
                <th className="p-3 text-right">Ngày công chuẩn (Kchuẩn)</th>
                <th className="p-3 text-left">Ghi chú / Tiến độ</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {periods.map((p) => {
                const ed = editing[p.period_code] || {};
                const isCur = p.period_code === currentPeriodCode;
                return (
                  <tr key={p.period_code} className={isCur ? 'bg-rose-50/40' : 'hover:bg-slate-50'}>
                    <td className="p-3 font-mono font-semibold text-slate-700">
                      {p.period_code}
                      {isCur && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9E1B32] text-white">HIỆN HÀNH</span>}
                    </td>
                    <td className="p-3 font-semibold text-slate-900">{p.period_name}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${periodStatusBadge(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="p-3 text-center text-slate-600">{p.closed_date || '—'}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        step="0.5"
                        value={ed.standard_days !== undefined ? ed.standard_days : p.standard_days}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [p.period_code]: { ...prev[p.period_code], standard_days: e.target.value } }))}
                        className="w-20 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={ed.note !== undefined ? ed.note : p.note}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [p.period_code]: { ...prev[p.period_code], note: e.target.value } }))}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm"
                      />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => handleSavePeriod(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" /> Lưu
                      </button>
                      {p.status === 'ĐANG MỞ' ? (
                        <button
                          onClick={() => {
                            if (window.confirm(`Chốt sổ & Khóa kỳ ${p.period_name}? Nếu kỳ đã có đủ dữ liệu chi tiết, số liệu sẽ được đồng bộ vào Tích lũy V3.`)) {
                              handleAction(() => apiFetch(`/api/admin/periods/${p.period_code}/lock?sync_snapshot=true`, { method: 'POST' }));
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                          title="Chốt sổ & Khóa kỳ này"
                        >
                          <Lock className="w-3.5 h-3.5" /> Khóa kỳ
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (window.confirm(`Mở khóa kỳ ${p.period_name} sang ĐANG MỞ để chỉnh sửa dữ liệu (Chấm công, Chỉ tiêu, Lương, Vi phạm)?`)) {
                              handleAction(async () => {
                                const r = await apiFetch(`/api/admin/periods/${p.period_code}/reopen?switch_to_current=true`, { method: 'POST' });
                                if (onSelectPeriod) onSelectPeriod(p.period_code);
                                return r;
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer"
                          title="Mở kỳ này sang ĐANG MỞ để chỉnh sửa"
                        >
                          <Unlock className="w-3.5 h-3.5" /> Mở khóa sửa
                        </button>
                      )}
                      <button
                        onClick={() => setClearModalPeriod(p.period_code)}
                        disabled={p.status === 'ĐÃ KHÓA'}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                        title={
                          p.status === 'ĐÃ KHÓA'
                            ? 'Kỳ ĐÃ KHÓA — bấm Mở khóa sửa trước khi xóa dữ liệu'
                            : `Xóa dữ liệu tháng ${p.period_name} (${summaryMap[p.period_code]?.total_rows ?? 0} dòng)`
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa DL
                      </button>
                      {!isCur && (
                        <button
                          onClick={() =>
                            handleAction(async () => {
                              const r = await apiFetch(`/api/admin/periods/switch/${p.period_code}`, { method: 'POST' });
                              if (onSelectPeriod) onSelectPeriod(p.period_code);
                              return r;
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#9E1B32] text-xs font-semibold cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Chọn làm kỳ chính
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold text-slate-800">
                <td colSpan={4} className="p-3 text-right">TỔNG NGÀY CÔNG CHUẨN CẢ NĂM:</td>
                <td className="p-3 text-right">{totalYearDays} ngày</td>
                <td colSpan={2} className="p-3 text-xs text-slate-500 font-normal">Dùng làm mẫu số Quyết toán năm trên Tích lũy V3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {clearModalPeriod && (
        <ClearMonthDataModal
          initialPeriodCode={clearModalPeriod}
          periodSummaryMap={summaryMap}
          onClose={() => setClearModalPeriod(null)}
          onCleared={async (res) => {
            if (res?.message) setMsg(res.message);
            await onRefreshPeriods();
            await loadSummary();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

