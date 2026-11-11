import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { periodStatusBadge } from '../utils/format';
import { animateSelectionPop } from '../utils/gsapSetup';
import {
  DATA_CLEAR_SCOPES,
  DEFAULT_CLEAR_SCOPES,
  clearDataByMonths,
} from './ClearMonthDataModal';
import { Lock, Trash2, KeyRound, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function SecurityView({ selectedPeriod, periods, onReloadPeriods, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [resetting, setResetting] = useState(false);

  // State cho xóa dữ liệu theo tháng (1 hoặc nhiều tháng)
  const [summaryList, setSummaryList] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(() =>
    curPeriod && curPeriod.status !== 'ĐÃ KHÓA' ? [selectedPeriod] : []
  );
  const [selectedScopes, setSelectedScopes] = useState(DEFAULT_CLEAR_SCOPES);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await apiFetch('/api/admin/periods/data-summary');
      const list = res.periods || [];
      setSummaryList(list);
      // Bỏ những kỳ đã khóa khỏi danh sách chọn nếu vừa có thay đổi trạng thái
      const lockedSet = new Set(list.filter((p) => p.status === 'ĐÃ KHÓA').map((p) => p.period_code));
      setSelectedMonths((prev) => prev.filter((c) => !lockedSet.has(c)));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingSummary(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (!oldPw || !newPw) {
      notify('Vui lòng nhập đầy đủ mật khẩu cũ và mới', 'error');
      return;
    }
    if (newPw.length < 4) {
      notify('Mật khẩu mới tối thiểu 4 ký tự', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      notify('Mật khẩu xác nhận không khớp', 'error');
      return;
    }
    setSavingPw(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      notify(res.message || 'Đã đổi mật khẩu Quản trị thành công');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const toggleMonth = (code, isLocked, e) => {
    if (isLocked) return;
    if (e?.currentTarget) animateSelectionPop(e.currentTarget, 0.96);
    setSelectedMonths((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const toggleScope = (key) => {
    setSelectedScopes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectAllOpenWithData = () => {
    const codes = summaryList
      .filter((p) => p.status !== 'ĐÃ KHÓA' && p.total_rows > 0)
      .map((p) => p.period_code);
    setSelectedMonths(codes);
  };

  const handleClearByMonths = async () => {
    if (selectedMonths.length === 0) {
      notify('Vui lòng chọn ít nhất một tháng cần xóa dữ liệu', 'error');
      return;
    }
    if (selectedScopes.length === 0) {
      notify('Vui lòng chọn ít nhất một nhóm dữ liệu cần xóa', 'error');
      return;
    }
    if (confirmReset.trim().toUpperCase() !== 'XOA DU LIEU') {
      notify('Vui lòng gõ chính xác "XOA DU LIEU" để xác nhận thao tác xóa dữ liệu theo tháng', 'error');
      return;
    }
    setResetting(true);
    try {
      const res = await clearDataByMonths(selectedMonths, selectedScopes);
      notify(res.message || 'Đã xóa dữ liệu các tháng đã chọn');
      setConfirmReset('');
      await loadSummary();
      if (onReloadPeriods) onReloadPeriods();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-[#9E1B32] mb-1">
          KHỐI 1 · MỤC 1.7 · BẢO MẬT & QUẢN TRỊ AN TOÀN DỮ LIỆU
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Đổi mật khẩu Quản trị & Xóa dữ liệu theo tháng</h2>
        <p className="text-sm text-slate-500 mt-1">
          Quản lý mật khẩu quản trị và xóa có chọn lọc dữ liệu từng tháng hoặc nhiều tháng (Lương V1+V2, Chỉ tiêu P2, Vi phạm, Tích lũy V3). Mọi thao tác đều ghi Audit Log.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Đổi mật khẩu Admin */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center gap-2 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-amber-300" /> Đổi mật khẩu tài khoản Quản trị (ADMIN)
          </div>
          <form onSubmit={handleChangePw} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="Nhập mật khẩu cũ..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-200 focus:border-[#9E1B32] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Tối thiểu 4 ký tự..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-200 focus:border-[#9E1B32] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-200 focus:border-[#9E1B32] outline-none"
              />
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Mật khẩu được mã hóa bằng thuật toán PBKDF2-SHA256 kèm salt ngẫu nhiên. Để đặt lại mật khẩu mặc định (<code className="font-bold">123456</code>) cho từng Cán bộ nhân viên, vui lòng thao tác tại mục <span className="font-semibold">1.3 Danh mục cán bộ</span>.
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPw}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-sm font-bold shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <Lock className="w-4 h-4" /> {savingPw ? 'Đang cập nhật...' : 'Cập nhật mật khẩu Quản trị'}
            </button>
          </form>
        </div>

        {/* Xóa dữ liệu theo tháng (1 hoặc nhiều kỳ) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
          <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-200" /> Xóa dữ liệu theo tháng (Chọn 1 hoặc nhiều kỳ)
            </div>
            <button
              type="button"
              onClick={loadSummary}
              disabled={loadingSummary}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-100 hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} /> Làm mới
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-700">
                1. Chọn các tháng cần xóa ({selectedMonths.length} tháng đang chọn):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {curPeriod && curPeriod.status !== 'ĐÃ KHÓA' && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonths([selectedPeriod])}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    Chọn kỳ hiện hành
                  </button>
                )}
                <button
                  type="button"
                  onClick={selectAllOpenWithData}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer"
                >
                  Chọn tháng chưa khóa có dữ liệu
                </button>
                {selectedMonths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonths([])}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer"
                  >
                    Bỏ chọn hết
                  </button>
                )}
              </div>
            </div>

            {loadingSummary ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang kiểm đếm dữ liệu 12 tháng...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {summaryList.map((m) => {
                  const locked = m.status === 'ĐÃ KHÓA';
                  const checked = selectedMonths.includes(m.period_code);
                  const isCur = m.period_code === selectedPeriod;
                  return (
                    <button
                      key={m.period_code}
                      type="button"
                      disabled={locked}
                      onClick={(e) => toggleMonth(m.period_code, locked, e)}
                      title={
                        locked
                          ? 'Kỳ ĐÃ KHÓA — vào 1.2 Quản lý 12 kỳ bấm Mở khóa sửa trước khi xóa'
                          : `Chọn/bỏ chọn ${m.period_name}`
                      }
                      className={`text-left p-2.5 rounded-xl border transition flex flex-col gap-1 ${
                        locked
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : checked
                          ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-300 cursor-pointer'
                          : 'bg-white border-slate-200 hover:border-rose-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            readOnly
                            disabled={locked}
                            checked={checked}
                            className="rounded accent-rose-700 pointer-events-none"
                          />
                          {m.period_name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${periodStatusBadge(m.status)}`}>
                          {locked ? 'KHÓA' : isCur ? 'HIỆN HÀNH' : m.status === 'ĐANG MỞ' ? 'MỞ' : 'CHƯA MỞ'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-5 tabular-nums">
                        Lương: <strong>{m.salary_count}</strong> · GK: <strong>{m.target_count}</strong> · VP: <strong>{m.violation_count}</strong> · V3: <strong>{m.snapshot_count}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">2. Phạm vi dữ liệu sẽ xóa ở các tháng đã chọn:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DATA_CLEAR_SCOPES.map((sc) => {
                  const checked = selectedScopes.includes(sc.key);
                  return (
                    <label
                      key={sc.key}
                      className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                        sc.key === 'snapshot_v3' ? 'sm:col-span-2 ' : ''
                      }${checked ? 'bg-rose-50/70 border-rose-200 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScope(sc.key)}
                        className="mt-0.5 rounded accent-rose-700"
                      />
                      <div>
                        <div className="font-semibold">{sc.label}</div>
                        {sc.caution && <div className="text-[11px] text-amber-700 mt-0.5">{sc.caution}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Các kỳ đang <strong>ĐÃ KHÓA</strong> tự động được khóa chọn để tránh xóa nhầm số liệu đã chốt sổ. Nếu muốn xóa một kỳ đã khóa, hãy vào <strong>Khối 1 · Mục 1.2 Quản lý 12 kỳ</strong> bấm <em>Mở khóa sửa</em> trước.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Gõ chính xác <code className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">XOA DU LIEU</code> để kích hoạt nút xóa:
                </label>
                <input
                  type="text"
                  value={confirmReset}
                  onChange={(e) => setConfirmReset(e.target.value)}
                  placeholder="XOA DU LIEU"
                  className="w-full px-3 py-2 border border-rose-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-rose-200 focus:border-rose-600 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleClearByMonths}
                disabled={resetting || selectedMonths.length === 0 || selectedScopes.length === 0 || confirmReset.trim().toUpperCase() !== 'XOA DU LIEU'}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold shadow-sm disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                {resetting
                  ? 'Đang xóa dữ liệu...'
                  : `Xóa dữ liệu (${selectedMonths.length} tháng)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

