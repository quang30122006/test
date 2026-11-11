import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, apiDownload } from '../api';
import { fmtMoney, fmtNum } from '../utils/format';
import DatasetImportWizard from './DatasetImportWizard';
import { Upload, Download, RefreshCw, Save, FileSpreadsheet, AlertCircle, CheckCircle2, Database } from 'lucide-react';

export default function ImportSalaryView({ selectedPeriod, periods, onNavigate, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importScope, setImportScope] = useState('SINGLE'); // 'SINGLE' | 'ALL_MONTHS'
  const [previewFile, setPreviewFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/operations/salary-import?period_code=${encodeURIComponent(selectedPeriod)}`);
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
        `/api/operations/dataset/preview-salary?scope=${importScope}&period_code=${encodeURIComponent(selectedPeriod)}`,
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

  const handleSyncCatalog = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch(`/api/operations/salary-import/sync-from-catalog?period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'POST',
      });
      notify(res.message || 'Đã đồng bộ từ 1.DM_CanBo');
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (r) => {
    setEditingCode(r.emp_code);
    setEditDraft({
      hsl_v1: r.hsl_v1,
      base_v1: r.base_v1,
      base_v2: r.base_v2,
      actual_workdays: r.actual_workdays,
      note: r.note || '',
    });
  };

  const saveEdit = async (empCode) => {
    try {
      await apiFetch(`/api/operations/salary-import/${empCode}?period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'PUT',
        body: JSON.stringify({
          hsl_v1: Number(editDraft.hsl_v1),
          base_v1: Number(editDraft.base_v1),
          base_v2: Number(editDraft.base_v2),
          actual_workdays: Number(editDraft.actual_workdays),
          note: editDraft.note,
        }),
      });
      notify(`Đã cập nhật dữ liệu lương của ${empCode}`);
      setEditingCode(null);
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const sumV1 = rows.reduce((acc, r) => acc + Number(r.base_v1 || 0), 0);
  const sumV2 = rows.reduce((acc, r) => acc + Number(r.base_v2 || 0), 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.1 · TIẾP NHẬN BẢNG LƯƠNG V1 + V2 (Import_LuongV1_V2)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Tiếp nhận Bảng lương & Định mức kỳ {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload Excel định dạng bất kỳ (tự động nhận diện cột Mã CB, V1, V2, Ngày công) hoặc đồng bộ nhanh từ Danh mục Cán bộ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => apiDownload('/api/payroll/template/salary', 'Mau_Import_Luong_1_Ky.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-600" /> Mẫu 1 kỳ
          </button>

          <button
            onClick={() => apiDownload('/api/operations/dataset/export-12-months?kind=salary&year_num=2026', 'DATASET_LUONG_12_THANG_2026.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Database className="w-4 h-4 text-rose-600" /> Xuất 12 Tháng
          </button>

          <button
            onClick={handleSyncCatalog}
            disabled={isLocked || syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Đồng bộ từ 1.DM_CanBo
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
          kind="salary"
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
          Kỳ {curPeriod?.period_name} đang ở trạng thái <strong>ĐÃ KHÓA</strong>. Chỉ được xem dữ liệu, không thể chỉnh sửa hoặc nạp đè.
        </div>
      )}

      {/* Tổng hợp nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Số cán bộ trong kỳ</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{rows.length} người</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Tổng Quỹ Lương V1 Định mức</div>
          <div className="text-2xl font-extrabold text-sky-700 mt-1">{fmtMoney(sumV1)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Tổng Quỹ Lương V2 Định mức</div>
          <div className="text-2xl font-extrabold text-[#9E1B32] mt-1">{fmtMoney(sumV2)} đ</div>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Mã CB</th>
                <th className="px-3 py-3">Họ và tên</th>
                <th className="px-3 py-3">Chức danh / Phòng</th>
                <th className="px-3 py-3">Loại LĐ</th>
                <th className="px-3 py-3 text-right">HSL V1</th>
                <th className="px-3 py-3 text-right">Lương V1 (ĐM)</th>
                <th className="px-3 py-3 text-right">Lương V2 (ĐM)</th>
                <th className="px-3 py-3 text-right">Công TT</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-center">Sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">Đang tải dữ liệu bảng lương...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Chưa có dữ liệu bảng lương trong kỳ này. Hãy nhấn <strong>Đồng bộ từ 1.DM_CanBo</strong> hoặc <strong>Nạp file Excel Lương</strong>.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isEditing = editingCode === r.emp_code;
                  return (
                    <tr key={r.emp_code} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{r.emp_code}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{r.full_name}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        <div>{r.title}</div>
                        <div className="text-[11px] text-slate-400">{r.department}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.labor_type === 'Trực tiếp' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>
                          {r.labor_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editDraft.hsl_v1}
                            onChange={(e) => setEditDraft({ ...editDraft, hsl_v1: e.target.value })}
                            className="w-16 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtNum(r.hsl_v1, 2)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editDraft.base_v1}
                            onChange={(e) => setEditDraft({ ...editDraft, base_v1: e.target.value })}
                            className="w-28 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtMoney(r.base_v1)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#9E1B32]">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editDraft.base_v2}
                            onChange={(e) => setEditDraft({ ...editDraft, base_v2: e.target.value })}
                            className="w-28 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtMoney(r.base_v2)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.5"
                            value={editDraft.actual_workdays}
                            onChange={(e) => setEditDraft({ ...editDraft, actual_workdays: e.target.value })}
                            className="w-16 px-1.5 py-1 border border-slate-300 rounded text-right"
                          />
                        ) : (
                          fmtNum(r.actual_workdays, 1)
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> {r.status || 'Hợp lệ'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLocked ? (
                          <span className="text-slate-300">—</span>
                        ) : isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => saveEdit(r.emp_code)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCode(null)}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(r)}
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

