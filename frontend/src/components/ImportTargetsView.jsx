import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, apiDownload } from '../api';
import { fmtNum } from '../utils/format';
import DatasetImportWizard from './DatasetImportWizard';
import { Upload, Download, Sparkles, Save, AlertCircle, Search, Database } from 'lucide-react';

export default function ImportTargetsView({ selectedPeriod, periods, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importScope, setImportScope] = useState('SINGLE'); // 'SINGLE' | 'ALL_MONTHS'
  const [previewFile, setPreviewFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [overwriteGen, setOverwriteGen] = useState(false);
  const [filterEmp, setFilterEmp] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState({ target_value: 0, actual_value: 0 });
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/operations/targets-execution?period_code=${encodeURIComponent(selectedPeriod)}`);
      setRows(data.rows || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch(
        `/api/operations/dataset/preview-targets?scope=${importScope}&period_code=${encodeURIComponent(selectedPeriod)}`,
        { method: 'POST', body: fd }
      );
      setPreviewFile(file);
      setPreviewData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch(
        `/api/operations/targets-execution/generate-from-catalog?period_code=${encodeURIComponent(selectedPeriod)}&overwrite=${overwriteGen}`,
        { method: 'POST' }
      );
      notify(res.message || 'Đã khởi tạo chỉ tiêu từ Danh mục GK');
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const saveCell = async (r) => {
    try {
      await apiFetch(`/api/operations/targets-execution?period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'PUT',
        body: JSON.stringify({
          emp_code: r.emp_code,
          indicator_code: r.indicator_code,
          target_value: Number(draft.target_value),
          actual_value: Number(draft.actual_value),
        }),
      });
      notify(`Đã lưu chỉ tiêu ${r.indicator_code} của ${r.full_name}`);
      setEditKey(null);
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const filtered = rows.filter((r) => {
    if (filterBranch !== 'ALL' && r.kpi_branch !== filterBranch) return false;
    if (filterEmp.trim()) {
      const q = filterEmp.trim().toLowerCase();
      if (!r.full_name.toLowerCase().includes(q) && !r.emp_code.toLowerCase().includes(q) && !r.indicator_code.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.2 · TIẾP NHẬN CHỈ TIÊU KINH DOANH (Import_ChiTieu)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Tiếp nhận & Giao khoán Chỉ tiêu tháng — {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Nạp file Excel kết quả kinh doanh hoặc tự động sinh mục tiêu tháng (Mục tiêu năm / 12) từ Cây chỉ tiêu giao khoán (GK).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => apiDownload('/api/payroll/template/targets', 'Mau_Import_Chi_Tieu_1_Ky.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-600" /> Mẫu 1 kỳ
          </button>

          <button
            onClick={() => apiDownload('/api/operations/dataset/export-12-months?kind=targets&year_num=2026', 'DATASET_CHI_TIEU_12_THANG_2026.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Database className="w-4 h-4 text-amber-600" /> Xuất 12 Tháng
          </button>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteGen}
              onChange={(e) => setOverwriteGen(e.target.checked)}
              className="rounded text-[#9E1B32]"
            />
            Ghi đè toàn bộ
          </label>

          <button
            onClick={handleGenerate}
            disabled={isLocked || generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> {generating ? 'Đang tạo...' : 'Sinh mục tiêu từ GK'}
          </button>

          <select
            value={importScope}
            onChange={(e) => setImportScope(e.target.value)}
            className="px-2.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800"
          >
            <option value="SINGLE">Nạp riêng kỳ {curPeriod?.period_name || selectedPeriod}</option>
            <option value="ALL_MONTHS">Nạp cả 12 tháng trong file</option>
          </select>

          <label
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm ${
              uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Đang kiểm tra...' : 'Chọn Excel & Xem trước'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              disabled={uploading}
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {previewData && (
        <DatasetImportWizard
          kind="targets"
          file={previewFile}
          scope={importScope}
          previewData={previewData}
          onClose={() => {
            setPreviewData(null);
            setPreviewFile(null);
          }}
          onCommitted={() => {
            setPreviewData(null);
            setPreviewFile(null);
            load();
          }}
          notify={notify}
        />
      )}

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Bạn chỉ có thể xem số liệu đã giao khoán.
        </div>
      )}

      {/* Bộ lọc */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterEmp}
            onChange={(e) => setFilterEmp(e.target.value)}
            placeholder="Tìm tên cán bộ, mã CB hoặc mã chỉ tiêu..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
          />
        </div>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:border-[#9E1B32]"
        >
          <option value="ALL">Tất cả 3 nhánh KPI</option>
          <option value="HDV">Nhánh Huy động vốn (HDV)</option>
          <option value="DV">Nhánh Dịch vụ (DV)</option>
          <option value="DN">Nhánh Dư nợ (DN)</option>
        </select>
        <div className="text-xs font-semibold text-slate-500">
          Hiển thị: <span className="text-slate-900 font-bold">{filtered.length}</span> / {rows.length} dòng chỉ tiêu
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3">Cán bộ</th>
                <th className="px-3 py-3">Loại LĐ</th>
                <th className="px-3 py-3">Nhánh</th>
                <th className="px-3 py-3">Chỉ tiêu</th>
                <th className="px-3 py-3 text-right">Trọng số wi</th>
                <th className="px-3 py-3 text-right">Mục tiêu Ti</th>
                <th className="px-3 py-3 text-right">Thực hiện Ai</th>
                <th className="px-3 py-3 text-right">Tỷ lệ Ci</th>
                <th className="px-3 py-3 text-right">Điểm Si</th>
                <th className="px-3 py-3 text-center">Sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">Đang tải dữ liệu...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">Không có dòng chỉ tiêu phù hợp.</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const key = `${r.emp_code}__${r.indicator_code}`;
                  const isEd = editKey === key;
                  return (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900">{r.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.emp_code}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{r.labor_type}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                          {r.kpi_branch}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-800">{r.indicator_name}</div>
                        <div className="text-[11px] text-slate-400">{r.indicator_code} · ĐVT: {r.unit}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{(r.weight_wi * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {isEd ? (
                          <input
                            type="number"
                            step="any"
                            value={draft.target_value}
                            onChange={(e) => setDraft({ ...draft, target_value: e.target.value })}
                            className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtNum(r.target_value, 2)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-[#9E1B32]">
                        {isEd ? (
                          <input
                            type="number"
                            step="any"
                            value={draft.actual_value}
                            onChange={(e) => setDraft({ ...draft, actual_value: e.target.value })}
                            className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtNum(r.actual_value, 2)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{(r.ratio_ci * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{fmtNum(r.score_si, 2)}</td>
                      <td className="px-3 py-2 text-center">
                        {isLocked ? (
                          '—'
                        ) : isEd ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => saveCell(r)}
                              className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditKey(null)}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditKey(key);
                              setDraft({ target_value: r.target_value, actual_value: r.actual_value });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Sửa
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

