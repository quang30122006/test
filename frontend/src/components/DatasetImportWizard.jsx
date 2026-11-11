import React, { useState } from 'react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum, periodStatusBadge } from '../utils/format';
import {
  CheckCircle2, AlertTriangle, Info, X, FileSpreadsheet, Upload, ShieldAlert, Eye
} from 'lucide-react';

/**
 * Hộp thoại/Panel Xem trước & Soát lỗi Dataset trước khi ghi vào DB (dùng chung cho Lương & Chỉ tiêu).
 */
export default function DatasetImportWizard({
  kind, // 'salary' | 'targets'
  file,
  scope, // 'SINGLE' | 'ALL_MONTHS'
  previewData,
  onClose,
  onCommitted,
  notify,
}) {
  const initialMonths = (previewData?.months_summary || [])
    .filter((m) => m.period_status !== 'ĐÃ KHÓA')
    .map((m) => m.month_num);
  // Nếu tất cả đều ĐÃ KHÓA (VD import kỳ lịch sử), chọn sẵn toàn bộ tháng tìm thấy để user quyết định
  const [selectedMonths, setSelectedMonths] = useState(
    initialMonths.length > 0 ? initialMonths : (previewData?.months_summary || []).map((m) => m.month_num)
  );
  const [overwriteLocked, setOverwriteLocked] = useState(false);
  const [syncHistory, setSyncHistory] = useState(false);
  const [activePreviewMonth, setActivePreviewMonth] = useState(
    String(previewData?.months_summary?.[0]?.month_num || '')
  );
  const [committing, setCommitting] = useState(false);

  if (!previewData) return null;

  const isSalary = kind === 'salary';
  const monthsSummary = previewData.months_summary || [];
  const issues = previewData.issues || [];
  const sampleRows = previewData.sample_by_month?.[activePreviewMonth] || [];
  const hasLockedSelected = monthsSummary.some(
    (m) => m.period_status === 'ĐÃ KHÓA' && selectedMonths.includes(m.month_num)
  );
  const criticalErrors = issues.filter((x) => x.severity === 'error');

  const toggleMonth = (mNum) => {
    setSelectedMonths((prev) =>
      prev.includes(mNum) ? prev.filter((x) => x !== mNum) : [...prev, mNum].sort((a, b) => a - b)
    );
  };

  const handleCommit = async () => {
    if (selectedMonths.length === 0) {
      notify('Vui lòng chọn ít nhất 1 tháng để ghi vào hệ thống', 'error');
      return;
    }
    if (hasLockedSelected && !overwriteLocked) {
      notify('Bạn đã chọn kỳ ĐÃ KHÓA — hãy bỏ chọn kỳ đó hoặc tích bật "Cho phép ghi vào kỳ ĐÃ KHÓA"', 'error');
      return;
    }
    setCommitting(true);
    try {
      const endpoint = isSalary ? '/api/operations/dataset/commit-salary' : '/api/operations/dataset/commit-targets';
      const q = new URLSearchParams({
        scope,
        period_code: monthsSummary.length === 1 ? monthsSummary[0].period_code : '',
        selected_months: selectedMonths.join(','),
        overwrite_locked: String(overwriteLocked),
        sync_history: String(syncHistory),
      });
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch(`${endpoint}?${q.toString()}`, {
        method: 'POST',
        body: fd,
      });
      notify(res.message || 'Nạp Dataset thành công');
      if (onCommitted) onCommitted(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#9E1B32] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#9E1B32] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-amber-300" />
          <div>
            <div className="font-extrabold text-sm sm:text-base">
              Kiểm tra & Xem trước Dataset {isSalary ? 'Bảng lương V1+V2' : 'Chỉ tiêu GK P2'} — {file?.name}
            </div>
            <div className="text-xs text-rose-100">
              Định dạng nhận diện: <strong>{previewData.detected_format}</strong> · Nguồn sheet: <strong>{(previewData.source_sheets || []).join(', ')}</strong> · Tổng <strong>{previewData.total_rows}</strong> dòng hợp lệ
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Tóm tắt từng tháng phát hiện được */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              1. Chọn các kỳ/tháng muốn nạp từ file ({selectedMonths.length}/{monthsSummary.length} tháng được chọn)
            </h4>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMonths(monthsSummary.map((m) => m.month_num))}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 cursor-pointer"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedMonths(monthsSummary.filter((m) => m.period_status !== 'ĐÃ KHÓA').map((m) => m.month_num))
                }
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-semibold text-emerald-800 cursor-pointer"
              >
                Chỉ chọn kỳ chưa khóa
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-2 text-center">Nạp</th>
                  <th className="px-3 py-2">Kỳ</th>
                  <th className="px-3 py-2">Trạng thái kỳ</th>
                  <th className="px-3 py-2 text-right">Số dòng</th>
                  {isSalary ? (
                    <>
                      <th className="px-3 py-2 text-right">Tổng V1</th>
                      <th className="px-3 py-2 text-right">Tổng V2</th>
                      <th className="px-3 py-2 text-right">Tổng công</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right">Số CB / CT</th>
                      <th className="px-3 py-2 text-right">Tổng Ti</th>
                      <th className="px-3 py-2 text-right">Tổng Ai</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-center">Cảnh báo</th>
                  <th className="px-3 py-2 text-center">Xem mẫu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthsSummary.map((m) => {
                  const checked = selectedMonths.includes(m.month_num);
                  return (
                    <tr key={m.month_num} className={checked ? 'bg-rose-50/40' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMonth(m.month_num)}
                          className="accent-[#9E1B32] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900">{m.period_name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${periodStatusBadge(m.period_status)}`}>
                          {m.period_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{m.row_count}</td>
                      {isSalary ? (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums text-sky-700 font-semibold">{fmtMoney(m.sum_v1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-[#9E1B32] font-semibold">{fmtMoney(m.sum_v2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.sum_workdays, 1)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{m.employee_count} CB · {m.indicator_count} CT</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.sum_ti, 2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-[#9E1B32]">{fmtNum(m.sum_ai, 2)}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-center">
                        {m.issue_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">{m.issue_count}</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setActivePreviewMonth(String(m.month_num))}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            activePreviewMonth === String(m.month_num)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Eye className="w-3 h-3" /> T{m.month_num}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cảnh báo kiểm tra hợp lệ */}
        {issues.length > 0 ? (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Phát hiện {issues.length} thông báo / cảnh báo kiểm tra dữ liệu ({criticalErrors.length} lỗi giá trị)
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
              {issues.slice(0, 30).map((iss, idx) => (
                <div key={idx} className={iss.severity === 'error' ? 'text-rose-700 font-semibold' : 'text-amber-800'}>
                  • [T{iss.month_num} · {iss.sheet_name} D{iss.row_num} · {iss.emp_code}] {iss.message}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Kiểm tra toàn vẹn Dataset hoàn hảo: Không phát hiện dòng trùng khóa, thiếu mã hay giá trị bất thường nào.
          </div>
        )}

        {/* Bảng xem trước dữ liệu chi tiết tháng đang chọn */}
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
            2. Xem trước chi tiết dữ liệu Tháng {activePreviewMonth} ({sampleRows.length} dòng đầu)
          </h4>
          <div className="overflow-x-auto max-h-56 border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-white sticky top-0">
                {isSalary ? (
                  <tr>
                    <th className="px-2.5 py-2">Mã CB</th>
                    <th className="px-2.5 py-2">Họ tên</th>
                    <th className="px-2.5 py-2">Chức danh / Nhóm</th>
                    <th className="px-2.5 py-2 text-right">HSL</th>
                    <th className="px-2.5 py-2 text-right">V1</th>
                    <th className="px-2.5 py-2 text-right">V2</th>
                    <th className="px-2.5 py-2 text-right">Công</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-2.5 py-2">Mã CB</th>
                    <th className="px-2.5 py-2">Họ tên</th>
                    <th className="px-2.5 py-2">Chỉ tiêu</th>
                    <th className="px-2.5 py-2 text-right">Mục tiêu (Ti)</th>
                    <th className="px-2.5 py-2 text-right">Thực hiện (Ai)</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sampleRows.slice(0, 40).map((r, i) =>
                  isSalary ? (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-2.5 py-1.5 font-mono">{r.emp_code}</td>
                      <td className="px-2.5 py-1.5 font-bold">
                        {r.full_name}
                        {r.is_new_emp && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px]">CB mới</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600">{r.title} · {r.labor_type}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(r.hsl_v1, 2)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtMoney(r.base_v1)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-[#9E1B32]">{fmtMoney(r.base_v2)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(r.actual_workdays, 1)}</td>
                    </tr>
                  ) : (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-2.5 py-1.5 font-mono">{r.emp_code}</td>
                      <td className="px-2.5 py-1.5 font-bold">{r.full_name}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="font-mono font-bold mr-1.5">{r.indicator_code}</span>
                        <span className="text-slate-600">{r.indicator_name}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtNum(r.target_value, 3)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-[#9E1B32]">{fmtNum(r.actual_value, 3)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tùy chọn bảo vệ kỳ khóa & đồng bộ snapshot */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={overwriteLocked}
              onChange={(e) => setOverwriteLocked(e.target.checked)}
              className="mt-0.5 accent-[#9E1B32]"
            />
            <span>
              Cho phép nạp dữ liệu chi tiết vào cả các kỳ <strong>ĐÃ KHÓA</strong> (VD: bổ sung dataset lịch sử T1–T9 để tra cứu chi tiết từng tháng). Mặc định chỉ nạp vào kỳ <strong>ĐANG MỞ / CHƯA MỞ</strong>.
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={syncHistory}
              onChange={(e) => setSyncHistory(e.target.checked)}
              className="mt-0.5 accent-[#9E1B32]"
            />
            <span>
              Tính lại KPI & ghi đè <strong>Snapshot Lịch sử Tích lũy V3</strong> cho các kỳ ĐÃ KHÓA sau khi nạp (chỉ bật nếu bạn muốn tính lại số quyết toán TichLuy_V3 theo dataset mới thay vì giữ số chốt sổ gốc).
            </span>
          </label>
          {hasLockedSelected && !overwriteLocked && (
            <div className="text-rose-700 font-bold flex items-center gap-1.5 pt-1">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Đang có kỳ ĐÃ KHÓA được chọn: vui lòng bỏ chọn các kỳ đó hoặc tích bật "Cho phép nạp vào kỳ ĐÃ KHÓA".
            </div>
          )}
          {!hasLockedSelected && (
            <div className="text-slate-500 flex items-center gap-1.5 pt-0.5">
              <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              Các kỳ đã chốt sổ không được chọn sẽ được giữ nguyên an toàn tuyệt đối.
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={committing || selectedMonths.length === 0 || (hasLockedSelected && !overwriteLocked)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {committing ? 'Đang ghi Dataset...' : `Xác nhận Ghi Dataset (${selectedMonths.length} kỳ)`}
          </button>
        </div>
      </div>
    </div>
  );
}

