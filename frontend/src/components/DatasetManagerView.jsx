import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, apiDownload } from '../api';
import { fmtMoney, fmtNum, periodStatusBadge } from '../utils/format';
import DatasetImportWizard from './DatasetImportWizard';
import ClearMonthDataModal from './ClearMonthDataModal';
import {
  Database, Upload, Download, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Trash2
} from 'lucide-react';

export default function DatasetManagerView({ onNavigate, onSelectPeriod, onReloadPeriods, notify }) {
  const [statusData, setStatusData] = useState(null);
  const [summaryMap, setSummaryMap] = useState({});
  const [clearModalPeriod, setClearModalPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Preview state
  const [previewKind, setPreviewKind] = useState(null); // 'salary' | 'targets'
  const [previewFile, setPreviewFile] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [parsing, setParsing] = useState(false);

  const salFileRef = useRef(null);
  const tgtFileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [res, sumRes] = await Promise.all([
        apiFetch('/api/operations/dataset/status?year_num=2026'),
        apiFetch('/api/admin/periods/data-summary'),
      ]);
      setStatusData(res);
      const map = {};
      (sumRes?.periods || []).forEach((p) => {
        map[p.period_code] = p;
      });
      setSummaryMap(map);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFilePick = async (kind, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = kind === 'salary'
        ? '/api/operations/dataset/preview-salary?scope=ALL_MONTHS'
        : '/api/operations/dataset/preview-targets?scope=ALL_MONTHS';
      const data = await apiFetch(url, { method: 'POST', body: fd });
      setPreviewKind(kind);
      setPreviewFile(file);
      setPreviewResult(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setParsing(false);
      if (salFileRef.current) salFileRef.current.value = '';
      if (tgtFileRef.current) tgtFileRef.current.value = '';
    }
  };

  const handleRecalcSnapshot = async (pcode = null) => {
    const msg = pcode
      ? `Tính lại KPI & đồng bộ Snapshot TichLuy_V3 cho kỳ ${pcode} từ dữ liệu Dataset chi tiết?`
      : 'Tính lại KPI & đồng bộ Snapshot TichLuy_V3 cho tất cả kỳ ĐÃ KHÓA có đủ dữ liệu chi tiết?';
    if (!window.confirm(msg)) return;
    setSyncing(true);
    try {
      const q = pcode ? `?period_code=${encodeURIComponent(pcode)}` : '';
      const res = await apiFetch(`/api/operations/dataset/recalculate-history${q}`, { method: 'POST' });
      notify(res.message || 'Đã đồng bộ Snapshot V3');
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const months = statusData?.months || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> KHỐI 2 · MỤC 2.0 · TRUNG TÂM QUẢN LÝ & IMPORT DATASET 12 THÁNG
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Điều phối Kho Dữ liệu 12 Kỳ (Lương V1+V2 · Chỉ tiêu GK · Snapshot V3)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Hỗ trợ nạp trọn bộ file 12 tháng (<code className="font-mono text-xs bg-slate-100 px-1 rounded">BANG_LUONG_12_THANG</code>, <code className="font-mono text-xs bg-slate-100 px-1 rounded">CHI_TIEU_12_THANG</code> hoặc 12 sheet <code className="font-mono text-xs bg-slate-100 px-1 rounded">Thang 01..12</code>), kiểm tra tính hợp lệ trước khi lưu và bảo vệ kỳ đã khóa sổ.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleRecalcSnapshot(null)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-300 ${syncing ? 'animate-spin' : ''}`} />
            Đồng bộ Snapshot V3 từ Dataset
          </button>
        </div>
      </div>

      {/* 2 Khối Thao tác Dataset 12 tháng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              1. Bộ Dataset Lương V1 + V2 & Ngày công (12 Tháng)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-[#9E1B32]">
              {statusData?.employee_master_count ?? 13} CB Master
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Tự động đọc sheet tổng hợp <code className="font-mono">BANG_LUONG_12_THANG</code> hoặc 12 sheet <code className="font-mono">Thang 01..12</code>. Kiểm tra trùng mã CB, thiếu ngày công và tự tạo preview chi tiết từng kỳ.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              {parsing ? 'Đang phân tích...' : 'Chọn file Lương 12 Tháng (.xlsx)'}
              <input
                ref={salFileRef}
                type="file"
                accept=".xlsx,.xlsm"
                onChange={(e) => handleFilePick('salary', e)}
                className="hidden"
              />
            </label>
            <button
              onClick={() => apiDownload('/api/operations/dataset/export-12-months?kind=salary&year_num=2026', 'DATASET_LUONG_12_THANG_2026.xlsx')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-600" /> Xuất Dataset Lương 12T
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              2. Bộ Dataset Chỉ tiêu Kinh doanh P2 (12 Tháng)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800">
              {statusData?.indicator_master_count ?? 8} Chỉ tiêu GK
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Tự động đọc sheet <code className="font-mono">CHI_TIEU_12_THANG</code> hoặc 12 sheet <code className="font-mono">Thang 01..12</code>. Kiểm tra mã chỉ tiêu <code className="font-mono">CT01..CT08</code>, đối soát mã cán bộ và phát hiện số liệu âm.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              {parsing ? 'Đang phân tích...' : 'Chọn file Chỉ tiêu 12 Tháng (.xlsx)'}
              <input
                ref={tgtFileRef}
                type="file"
                accept=".xlsx,.xlsm"
                onChange={(e) => handleFilePick('targets', e)}
                className="hidden"
              />
            </label>
            <button
              onClick={() => apiDownload('/api/operations/dataset/export-12-months?kind=targets&year_num=2026', 'DATASET_CHI_TIEU_12_THANG_2026.xlsx')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-600" /> Xuất Dataset Chỉ tiêu 12T
            </button>
          </div>
        </div>
      </div>

      {/* Preview & Validation Wizard */}
      {previewResult && (
        <DatasetImportWizard
          kind={previewKind}
          file={previewFile}
          scope="ALL_MONTHS"
          previewData={previewResult}
          onClose={() => {
            setPreviewResult(null);
            setPreviewFile(null);
          }}
          onCommitted={() => {
            setPreviewResult(null);
            setPreviewFile(null);
            load();
          }}
          notify={notify}
        />
      )}

      {/* Ma trận hiện trạng Dataset 12 tháng */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm">Ma trận Hiện trạng Dữ liệu 12 Kỳ Năm {statusData?.year_num || 2026}</h3>
          <span className="text-xs text-slate-300">Nhấp "Mở kỳ" để thao tác chi tiết trên kỳ đó</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase border-b border-slate-200">
              <tr>
                <th className="px-3 py-3">Kỳ lương</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-right">Công chuẩn</th>
                <th className="px-3 py-3 text-right">Dòng Lương V1+V2</th>
                <th className="px-3 py-3 text-right">Quỹ V1 / V2 ĐM</th>
                <th className="px-3 py-3 text-right">Dòng Chỉ tiêu P2</th>
                <th className="px-3 py-3 text-right">Tổng Ti / Ai</th>
                <th className="px-3 py-3 text-center">Lỗi VP</th>
                <th className="px-3 py-3 text-right">Snapshot V3</th>
                <th className="px-3 py-3">Mức độ sẵn sàng</th>
                <th className="px-3 py-3 text-center">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">Đang kiểm tra toàn bộ 12 kỳ dữ liệu...</td>
                </tr>
              ) : (
                months.map((m) => (
                  <tr key={m.period_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{m.period_name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${periodStatusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{m.standard_days}d</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">{m.salary_count} CB</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.salary_count > 0 ? (
                        <div>
                          <div className="text-sky-700 font-semibold">{fmtMoney(m.salary_v1_sum)}</div>
                          <div className="text-[#9E1B32] font-semibold">{fmtMoney(m.salary_v2_sum)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">{m.target_count} dòng</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.target_count > 0 ? (
                        <span>{fmtNum(m.target_ti_sum, 1)} / <strong className="text-[#9E1B32]">{fmtNum(m.target_ai_sum, 1)}</strong></span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{m.violation_count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.snapshot_count > 0 ? (
                        <span className="font-semibold text-emerald-700">{m.snapshot_count} CB ({fmtMoney(m.snapshot_v2_sum)})</span>
                      ) : (
                        <span className="text-slate-300">Chưa chốt</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        m.readiness === 'Đủ dữ liệu chi tiết'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.readiness === 'Chỉ có Snapshot V3'
                          ? 'bg-sky-100 text-sky-800'
                          : m.readiness.startsWith('Thiếu')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.readiness === 'Đủ dữ liệu chi tiết' ? <CheckCircle2 className="w-3 h-3" /> : m.readiness.startsWith('Thiếu') ? <AlertTriangle className="w-3 h-3" /> : null}
                        {m.readiness}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            if (onSelectPeriod) onSelectPeriod(m.period_code);
                            onNavigate('payroll_3p');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                          title="Chuyển kỳ hiện xem sang tháng này và mở Bảng lương 3P"
                        >
                          Xem 3P <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setClearModalPeriod(m.period_code)}
                          disabled={m.status === 'ĐÃ KHÓA' || ((summaryMap[m.period_code]?.total_rows ?? (m.salary_count + m.target_count + m.violation_count + m.snapshot_count)) === 0)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                          title={
                            m.status === 'ĐÃ KHÓA'
                              ? 'Kỳ ĐÃ KHÓA — vào 1.2 Quản lý 12 kỳ bấm Mở khóa sửa trước khi xóa'
                              : `Xóa dữ liệu của ${m.period_name}`
                          }
                        >
                          <Trash2 className="w-3 h-3" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {clearModalPeriod && (
        <ClearMonthDataModal
          initialPeriodCode={clearModalPeriod}
          periodSummaryMap={summaryMap}
          onClose={() => setClearModalPeriod(null)}
          onCleared={async () => {
            await load();
            if (onReloadPeriods) onReloadPeriods();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

