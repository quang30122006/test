import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { periodStatusBadge } from '../utils/format';
import { gsap, useGSAP, runReducedMotionAware } from '../utils/gsapSetup';
import { AlertTriangle, Lock, Trash2, X } from 'lucide-react';

export const DATA_CLEAR_SCOPES = [
  {
    key: 'salary',
    label: 'Bảng lương V1 + V2 & Ngày công chấm công',
    countKey: 'salary_count',
    defaultOn: true,
  },
  {
    key: 'targets',
    label: 'Số liệu Chỉ tiêu giao khoán P2 (Ti / Ai)',
    countKey: 'target_count',
    defaultOn: true,
  },
  {
    key: 'violations',
    label: 'Nhật ký lỗi vi phạm & Hàng chờ KSV',
    countKey: 'violation_count',
    defaultOn: true,
  },
  {
    key: 'overrides',
    label: 'Điểm cộng ưu tiên / Ghi chú tháng (KPI_Thang)',
    countKey: 'override_count',
    defaultOn: true,
  },
  {
    key: 'snapshot_v3',
    label: 'Snapshot Tích lũy V3 của tháng này',
    countKey: 'snapshot_count',
    defaultOn: false,
    caution: 'Chỉ chọn nếu muốn xóa trắng cả dữ liệu lũy kế V3 của tháng đã chọn để nạp lại từ đầu.',
  },
];

export const DEFAULT_CLEAR_SCOPES = DATA_CLEAR_SCOPES.filter((s) => s.defaultOn).map((s) => s.key);

export async function clearDataByMonths(periodCodes, scopes) {
  return apiFetch('/api/admin/periods/clear-by-months', {
    method: 'POST',
    body: JSON.stringify({
      period_codes: periodCodes,
      scopes,
    }),
  });
}

export default function ClearMonthDataModal({ initialPeriodCode, periodSummaryMap = {}, onClose, onCleared, notify }) {
  const modalCardRef = useRef(null);
  const [selectedCode, setSelectedCode] = useState(initialPeriodCode || '');
  const [scopes, setScopes] = useState(DEFAULT_CLEAR_SCOPES);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useGSAP(() => {
    if (!modalCardRef.current) return;
    return runReducedMotionAware(() => {
      gsap.fromTo(
        modalCardRef.current,
        { scale: 0.94, y: 14, autoAlpha: 0 },
        { scale: 1, y: 0, autoAlpha: 1, duration: 0.28, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' }
      );
    });
  }, { scope: modalCardRef });

  const summary = periodSummaryMap[selectedCode] || null;
  const isLocked = summary?.status === 'ĐÃ KHÓA';

  useEffect(() => {
    setSelectedCode(initialPeriodCode || '');
    setConfirmText('');
    setScopes(DEFAULT_CLEAR_SCOPES);
  }, [initialPeriodCode]);

  const toggleScope = (key) => {
    setScopes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!selectedCode) return;
    if (scopes.length === 0) {
      if (notify) notify('Vui lòng chọn ít nhất một nhóm dữ liệu cần xóa', 'error');
      return;
    }
    if (confirmText.trim().toUpperCase() !== 'XOA DU LIEU') {
      if (notify) notify('Vui lòng gõ chính xác "XOA DU LIEU" để xác nhận', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await clearDataByMonths([selectedCode], scopes);
      if (notify) notify(res.message || 'Đã xóa dữ liệu tháng thành công');
      if (onCleared) await onCleared(res);
      onClose();
    } catch (err) {
      if (notify) notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const allPeriods = Object.values(periodSummaryMap).sort((a, b) => (a.month_num || 0) - (b.month_num || 0));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div ref={modalCardRef} className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Trash2 className="w-4 h-4 text-amber-200" />
            Xóa dữ liệu theo tháng — {summary?.period_name || selectedCode}
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {allPeriods.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tháng cần xóa dữ liệu</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white outline-none focus:border-rose-600"
                >
                  {allPeriods.map((p) => (
                    <option key={p.period_code} value={p.period_code}>
                      {p.period_name} ({p.status}) — {p.total_rows} dòng dữ liệu
                    </option>
                  ))}
                </select>
                {summary && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${periodStatusBadge(summary.status)}`}>
                    {summary.status}
                  </span>
                )}
              </div>
            </div>
          )}

          {isLocked ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                Kỳ <strong>{summary?.period_name}</strong> đang ở trạng thái <strong>ĐÃ KHÓA</strong> nên được bảo vệ không cho xóa. Nếu cần làm sạch, hãy bấm <strong>Mở khóa sửa</strong> tại <em>1.2 Quản lý 12 kỳ</em> trước.
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">Chọn nhóm dữ liệu cần xóa của {summary?.period_name || selectedCode}:</div>
                <div className="space-y-1.5">
                  {DATA_CLEAR_SCOPES.map((sc) => {
                    const cnt = summary ? summary[sc.countKey] ?? 0 : null;
                    const checked = scopes.includes(sc.key);
                    return (
                      <label
                        key={sc.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          checked ? 'bg-rose-50/70 border-rose-200 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(sc.key)}
                          className="mt-0.5 rounded accent-rose-700"
                        />
                        <div className="flex-1">
                          <div className="font-semibold flex items-center justify-between gap-2">
                            <span>{sc.label}</span>
                            {cnt !== null && (
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                {cnt} dòng
                              </span>
                            )}
                          </div>
                          {sc.caution && (
                            <p className="text-[11px] text-amber-700 mt-0.5">{sc.caution}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Dữ liệu bị xóa trong tháng này không thể khôi phục (mọi thao tác được ghi Audit Log).</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gõ chính xác <code className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">XOA DU LIEU</code> để xác nhận:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="XOA DU LIEU"
                  className="w-full px-3 py-2 border border-rose-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-rose-200 focus:border-rose-600 outline-none"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting || isLocked || scopes.length === 0 || confirmText.trim().toUpperCase() !== 'XOA DU LIEU'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {submitting ? 'Đang xóa...' : `Xóa dữ liệu ${summary?.period_name || selectedCode}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

