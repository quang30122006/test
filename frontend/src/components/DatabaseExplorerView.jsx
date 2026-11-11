import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { gsap, useGSAP, runReducedMotionAware, animateSelectionPop, animateTabContentEnter } from '../utils/gsapSetup';
import { Database, Search, Printer, RefreshCw, Table2 } from 'lucide-react';

export default function DatabaseExplorerView({ notify }) {
  const [overview, setOverview] = useState(null);
  const [selectedTable, setSelectedTable] = useState('employees');
  const [tableData, setTableData] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const listWrapRef = useRef(null);
  const activeBarRef = useRef(null);
  const tableBtnRefs = useRef({});
  const panelRef = useRef(null);
  const isFirstTableRef = useRef(true);

  const loadOverview = async () => {
    try {
      const res = await apiFetch('/api/admin/database-overview');
      setOverview(res);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const loadTable = async (tname = selectedTable, qStr = query) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/database-table/${encodeURIComponent(tname)}?q=${encodeURIComponent(qStr)}&limit=200`
      );
      setTableData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadTable(selectedTable, query);
  }, [selectedTable]);

  useGSAP(() => {
    const bar = activeBarRef.current;
    const btn = tableBtnRefs.current[selectedTable];
    if (!bar || !btn) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const target = { y: btn.offsetTop, height: btn.offsetHeight, autoAlpha: 1 };
    if (reduced || isFirstTableRef.current) {
      gsap.set(bar, target);
    } else {
      gsap.to(bar, { ...target, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
      animateSelectionPop(btn, 0.985);
    }
  }, { scope: listWrapRef, dependencies: [selectedTable, overview?.tables?.length] });

  useGSAP(() => {
    if (isFirstTableRef.current) {
      if (!loading) isFirstTableRef.current = false;
      return;
    }
    if (!panelRef.current || loading) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(panelRef.current, { y: 10, duration: 0.25 });
    });
  }, { dependencies: [selectedTable, loading] });

  const tables = overview?.tables || [];

  return (
    <div className="space-y-5">
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1 flex items-center gap-1.5">
            <Database className="w-4 h-4" /> KHỐI 4 · MỤC 4.5 · CƠ SỞ DỮ LIỆU SQLITE HỆ THỐNG WEB
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Kho {overview?.table_count || 13} Bảng Dữ liệu CSDL Web ({overview?.total_records ?? '...'} bản ghi)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Nguồn lưu trữ thực tế: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{overview?.engine || 'SQLite'}</code>. Chọn bất kỳ bảng nào bên dưới để tra cứu, tìm kiếm và in dữ liệu trực tiếp.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { loadOverview(); loadTable(selectedTable, query); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" /> In bảng hiện tại
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Danh sách 13 bảng */}
        <div className="no-print xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            <Table2 className="w-4 h-4 text-amber-300" /> Danh sách Bảng Dữ liệu ({tables.length})
          </div>
          <div ref={listWrapRef} className="relative divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            <span
              ref={activeBarRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 w-1 bg-[#9E1B32] rounded-r opacity-0 z-10"
            />
            {tables.map((t) => {
              const active = selectedTable === t.table_name;
              return (
                <button
                  key={t.table_name}
                  ref={(el) => { if (el) tableBtnRefs.current[t.table_name] = el; }}
                  onClick={() => { setSelectedTable(t.table_name); setQuery(''); }}
                  className={`w-full text-left pl-5 pr-4 py-3 flex items-center justify-between gap-2 transition cursor-pointer ${
                    active ? 'bg-rose-50/90' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-xs sm:text-sm font-bold truncate ${active ? 'text-[#9E1B32]' : 'text-slate-800'}`}>
                      {t.label}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{t.column_count} cột dữ liệu</div>
                  </div>
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 tabular-nums">
                    {t.row_count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nội dung bảng được chọn */}
        <div ref={panelRef} className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="no-print p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="font-bold text-sm text-slate-900">{tableData?.label || selectedTable}</div>
            <form
              onSubmit={(e) => { e.preventDefault(); loadTable(selectedTable, query); }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm kiếm trong bảng..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:border-[#9E1B32]"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#9E1B32] text-white text-xs font-bold cursor-pointer"
              >
                Lọc
              </button>
            </form>
          </div>

          <div className="px-4 py-2 bg-white border-b border-slate-100 text-xs text-slate-500">
            Bảng: <strong className="font-mono text-slate-800">{tableData?.table_name}</strong> · Tổng dòng khớp: <strong>{tableData?.total_matched ?? 0}</strong> (hiển thị tối đa 200 dòng)
          </div>

          <div className="overflow-x-auto max-h-[540px] flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-white sticky top-0 z-10">
                <tr>
                  {(tableData?.columns || []).map((col) => (
                    <th key={col} className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={Math.max(1, tableData?.columns?.length || 1)} className="py-10 text-center text-slate-400">
                      Đang truy vấn dữ liệu SQLite...
                    </td>
                  </tr>
                ) : (tableData?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, tableData?.columns?.length || 1)} className="py-10 text-center text-slate-400">
                      Không có bản ghi nào khớp điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  (tableData?.rows || []).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {(tableData?.columns || []).map((col) => (
                        <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[260px] truncate tabular-nums">
                          {r[col] === null || r[col] === undefined ? <span className="text-slate-300">null</span> : String(r[col])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

