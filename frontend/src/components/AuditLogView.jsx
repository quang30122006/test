import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { RefreshCw, Search, FileSearch } from 'lucide-react';

export default function AuditLogView({ notify }) {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/payroll/audit-log?limit=300');
      setLogs(res || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = logs.filter((l) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (l.log_code || '').toLowerCase().includes(q) ||
      (l.actor || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.target_data || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">
            KHỐI 4 · MỤC 4.3 · NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT_LOG)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Lịch sử Thao tác, Đóng/Mở Kỳ & Thay đổi Công thức</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mọi hành động sửa tham số, chốt sổ, duyệt KSV, import Excel đều được ghi vết bất biến theo thời gian thực.
          </p>
        </div>

        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã log, người thực hiện, hành động, chi tiết..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Hiển thị <strong>{filtered.length}</strong> / {logs.length} sự kiện gần nhất
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3">Mã Log</th>
                <th className="px-3 py-3">Thời gian</th>
                <th className="px-3 py-3">Người thực hiện</th>
                <th className="px-3 py-3">Hành động</th>
                <th className="px-3 py-3">Đối tượng</th>
                <th className="px-3 py-3">Chi tiết nghiệp vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">Đang tải nhật ký kiểm toán...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Không có bản ghi audit log nào khớp.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-700">{l.log_code}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{l.timestamp}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{l.actor}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{l.target_data}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{l.details}</td>
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

