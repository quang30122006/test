import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum, ksvStatusBadge } from '../utils/format';
import { PlusCircle, Trash2, Search, ClipboardList, ShieldAlert } from 'lucide-react';

export default function ViolationLogView({ selectedPeriod, periods, onNavigate, notify, onReloadKsv }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [items, setItems] = useState([]);
  const [scopePeriod, setScopePeriod] = useState(selectedPeriod);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setScopePeriod(selectedPeriod);
  }, [selectedPeriod]);

  const load = async (pcode = scopePeriod) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/operations/violations?period_code=${encodeURIComponent(pcode)}`);
      setItems(data.items || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(scopePeriod);
  }, [scopePeriod]);

  const handleDelete = async (recordCode) => {
    if (!window.confirm(`Xác nhận xóa vĩnh viễn biên bản ${recordCode}?`)) return;
    try {
      const res = await apiFetch(`/api/operations/violations/${recordCode}`, { method: 'DELETE' });
      notify(res.message || `Đã xóa ${recordCode}`);
      load(scopePeriod);
      if (onReloadKsv) onReloadKsv();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const filtered = items.filter((r) => {
    if (statusFilter !== 'ALL' && r.ksv_status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (
        !r.record_code.toLowerCase().includes(q) &&
        !r.emp_name.toLowerCase().includes(q) &&
        !r.error_code.toLowerCase().includes(q) &&
        !r.error_detail.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalEmpPts = filtered.reduce((acc, r) => acc + Number(r.emp_deduction || 0), 0);
  const totalKsvApplied = filtered.reduce((acc, r) => acc + Number(r.ksv_applied_points || 0), 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.6 · NHẬT KÝ LỖI & VI PHẠM (NhatKy_Loi)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Nhật ký vi phạm Nội quy (P1) & Nghiệp vụ (P3)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi toàn bộ biên bản vi phạm, điểm trừ trực tiếp của cán bộ, liên đới Kiểm soát viên & Người phê duyệt.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('ksv_queue')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" /> Hàng chờ KSV
          </button>
          <button
            onClick={() => onNavigate('violation_form')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Ghi nhận lỗi mới
          </button>
        </div>
      </div>

      {/* Bộ lọc & Tóm tắt */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm số BB, tên cán bộ, mã lỗi..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
            />
          </div>

          <select
            value={scopePeriod}
            onChange={(e) => setScopePeriod(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
          >
            <option value={selectedPeriod}>Kỳ hiện xem ({curPeriod?.period_name || selectedPeriod})</option>
            <option value="ALL">Tất cả các kỳ trong năm</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
          >
            <option value="ALL">Tất cả trạng thái KSV</option>
            <option value="PENDING">Đang chờ KSV duyệt</option>
            <option value="APPROVED">KSV đã chấp nhận</option>
            <option value="REJECTED">KSV đã từ chối</option>
            <option value="NONE">Không liên đới KSV</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <span>Số biên bản: <strong className="text-slate-900">{filtered.length}</strong></span>
          <span>Trừ CB: <strong className="text-rose-700">-{fmtNum(totalEmpPts, 1)}đ</strong></span>
          <span>Trừ KSV đã duyệt: <strong className="text-amber-700">-{fmtNum(totalKsvApplied, 1)}đ</strong></span>
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Mã BB / Ngày</th>
                <th className="px-3 py-3">Cán bộ vi phạm</th>
                <th className="px-3 py-3">Trụ cột / Mã lỗi</th>
                <th className="px-3 py-3">Nội dung vi phạm</th>
                <th className="px-3 py-3 text-right">Điểm trừ CB</th>
                <th className="px-3 py-3">Liên đới KSV</th>
                <th className="px-3 py-3">Trạng thái KSV</th>
                <th className="px-3 py-3">Người phê duyệt</th>
                <th className="px-3 py-3 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">Đang tải nhật ký vi phạm...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Không có biên bản vi phạm nào khớp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const st = ksvStatusBadge(r.ksv_status);
                  return (
                    <tr key={r.record_code} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold text-slate-900">{r.record_code}</div>
                        <div className="text-[11px] text-slate-400">{r.created_date} · {r.period_name}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{r.emp_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.emp_code}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${r.pillar_type === '3.1' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                          {r.pillar_type === '3.1' ? 'P1 · Nội quy' : 'P3 · KPI NV'}
                        </span>
                        <div className="font-mono text-xs text-slate-700 font-bold mt-1">{r.error_code}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <div className="text-xs text-slate-700 line-clamp-2">{r.error_detail}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-rose-700">
                        -{fmtNum(r.emp_deduction, 1)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.has_ksv_resp ? (
                          <div>
                            <div className="font-semibold text-slate-800">{r.ksv_emp_name}</div>
                            <div className="text-[11px] text-amber-700 font-bold">
                              Đề xuất: -{fmtNum(r.ksv_proposed_points, 1)}đ · Thực áp: -{fmtNum(r.ksv_applied_points, 1)}đ
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {r.ksv_note && <div className="text-[11px] text-slate-500 mt-0.5 italic">{r.ksv_note}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.has_approver_resp ? (
                          <div>
                            <div className="font-semibold text-slate-800">{r.approver_emp_name}</div>
                            <div className="text-[11px] text-rose-600 font-bold">-{fmtNum(r.approver_points, 1)}đ</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLocked && scopePeriod !== 'ALL' ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <button
                            onClick={() => handleDelete(r.record_code)}
                            title="Xóa biên bản"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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

