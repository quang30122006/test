import React, { useEffect, useState } from 'react';
import { Sliders, Play, Save, RotateCcw, CheckCircle2, AlertTriangle, Calculator } from 'lucide-react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';

export default function FormulaStudioView({ selectedPeriod, onConfigSaved }) {
  const [config, setConfig] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [indWeights, setIndWeights] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recalcIndirect, setRecalcIndirect] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/config');
      setConfig(data.config);
      setTiers(data.tiers);
      setIndWeights(data.indicator_weights || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading || !config) {
    return <div className="p-8 text-center text-slate-500">Đang tải cấu hình công thức & trọng số...</div>;
  }

  const pillarSum = Math.round((Number(config.w_cm) + Number(config.w_kpi) + Number(config.w_reserve)) * 10000) / 100;
  const subKpiSum = Math.round((Number(config.w_kpi_dv) + Number(config.w_kpi_hdv) + Number(config.w_kpi_dn)) * 10000) / 100;

  const setField = (k, v) => setConfig((prev) => ({ ...prev, [k]: v }));

  const updateTier = (idx, field, val) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  };

  const handleSimulate = async () => {
    setErr('');
    setMsg('');
    setSimulating(true);
    try {
      const res = await apiFetch('/api/admin/config/simulate', {
        method: 'POST',
        body: JSON.stringify({
          period_code: selectedPeriod,
          config,
          tiers,
          include_open_in_v3: false,
        }),
      });
      setSimResult(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleSaveAll = async () => {
    setErr('');
    setMsg('');
    setSaving(true);
    try {
      await apiFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ ...config, recalc_indirect_targets: recalcIndirect }),
      });
      await apiFetch('/api/admin/rating-tiers', {
        method: 'PUT',
        body: JSON.stringify(tiers),
      });
      setMsg('Đã lưu toàn bộ công thức, trọng số & Ma trận xếp loại. Toàn hệ thống đã được cập nhật!');
      setSimResult(null);
      if (onConfigSaved) onConfigSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Khôi phục toàn bộ công thức & trọng số về chuẩn Hội sở Agribank 2026?')) return;
    setErr('');
    setMsg('');
    try {
      await apiFetch('/api/admin/config/reset-defaults', { method: 'POST' });
      await loadConfig();
      setSimResult(null);
      setMsg('Đã khôi phục cấu hình mặc định chuẩn 2026.');
      if (onConfigSaved) onConfigSaved();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#9E1B32] font-bold text-xs uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" /> Trung tâm Kiểm soát Toán học & Quy chế 3P
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Studio Điều chỉnh Công thức, Trọng số & Chỉ số Toàn diện</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Tùy chỉnh mọi biến số, công thức tính KPI, hệ số T<sub>cv</sub>, quỹ lương V1/V2/QNS/V3 và chạy giả lập so sánh trước khi áp dụng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Khôi phục chuẩn 2026
          </button>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Play className="w-4 h-4" /> {simulating ? 'Đang chạy thử...' : 'Chạy Giả lập (So sánh)'}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || Math.abs(pillarSum - 100) > 0.05 || Math.abs(subKpiSum - 100) > 0.05}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu & Áp dụng Toàn hệ thống'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {msg}
        </div>
      )}
      {err && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {err}
        </div>
      )}

      {/* Kết quả giả lập What-If */}
      {simResult && (
        <div className="bg-amber-50/70 rounded-2xl border-2 border-amber-300 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-amber-900 flex items-center gap-2">
              <Calculator className="w-5 h-5" /> Kết quả Giả lập Công thức mới (Chưa ghi đè DB)
            </h3>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <span className="px-3 py-1 rounded-lg bg-white border border-amber-200">
                Điểm CV BQ: {simResult.baseline_avg_score} → <strong className="text-[#9E1B32]">{simResult.simulated_avg_score}</strong>
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-amber-200">
                Tổng V2 sau ĐC: {fmtMoney(simResult.baseline_totals.v2_adj)} → <strong className="text-[#9E1B32]">{fmtMoney(simResult.simulated_totals.v2_adj)} đ</strong>
              </span>
              <span className="px-3 py-1 rounded-lg bg-white border border-amber-200">
                Quỹ Thù lao V3: {fmtMoney(simResult.baseline_v3_total)} → <strong className="text-[#9E1B32]">{fmtMoney(simResult.simulated_v3_total)} đ</strong>
              </span>
            </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-xl border border-amber-200">
            <table className="w-full text-xs">
              <thead className="bg-amber-100/70 text-amber-950 font-bold">
                <tr>
                  <th className="p-2.5 text-left">Cán bộ</th>
                  <th className="p-2.5 text-right">Điểm CV (Cũ → Mới)</th>
                  <th className="p-2.5 text-right">Tcv (Cũ → Mới)</th>
                  <th className="p-2.5 text-center">Loại</th>
                  <th className="p-2.5 text-right">V2 sđc (Chênh lệch)</th>
                  <th className="p-2.5 text-right">Thực lĩnh (Chênh lệch)</th>
                  <th className="p-2.5 text-right">Thù lao V3 (Chênh lệch)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {simResult.comparisons.map((c) => (
                  <tr key={c.emp_code} className="hover:bg-slate-50">
                    <td className="p-2.5 font-medium">{c.full_name}</td>
                    <td className="p-2.5 text-right">{c.old_work_score} → <strong>{c.new_work_score}</strong></td>
                    <td className="p-2.5 text-right">{c.old_tcv} → <strong>{c.new_tcv}</strong></td>
                    <td className="p-2.5 text-center">{c.old_rating} → <strong>{c.new_rating}</strong></td>
                    <td className="p-2.5 text-right">
                      {fmtMoney(c.new_v2_adj)}
                      <span className={`ml-1 text-[11px] ${c.delta_v2 > 0 ? 'text-emerald-600' : c.delta_v2 < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ({c.delta_v2 >= 0 ? '+' : ''}{fmtMoney(c.delta_v2)})
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-semibold">
                      {fmtMoney(c.new_takehome)}
                      <span className={`ml-1 text-[11px] ${c.delta_takehome > 0 ? 'text-emerald-600' : c.delta_takehome < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ({c.delta_takehome >= 0 ? '+' : ''}{fmtMoney(c.delta_takehome)})
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      {fmtMoney(c.new_v3)}
                      <span className={`ml-1 text-[11px] ${c.delta_v3 > 0 ? 'text-emerald-600' : c.delta_v3 < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ({c.delta_v3 >= 0 ? '+' : ''}{fmtMoney(c.delta_v3)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phần 1 & 2: Trọng số & Quy tắc Chuyên môn / KPI */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Khối Trọng số & Thông tin đơn vị */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3">
            I. Trọng số Trụ cột & Chỉ tiêu KPI Kinh doanh
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Tên Chi nhánh / Đơn vị (hiển thị trên biểu mẫu in)</label>
              <input
                type="text"
                value={config.org_name}
                onChange={(e) => setField('org_name', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trọng số Chuyên môn P1/P3 (tỉ lệ 0–1)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_cm}
                onChange={(e) => setField('w_cm', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trọng số KPI Kinh doanh P2 (tỉ lệ 0–1)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_kpi}
                onChange={(e) => setField('w_kpi', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trọng số Dự phòng điều hành</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_reserve}
                onChange={(e) => setField('w_reserve', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <div className={`w-full px-3 py-2 rounded-xl text-xs font-bold border ${Math.abs(pillarSum - 100) <= 0.05 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                Tổng 3 trụ cột: {pillarSum}% {Math.abs(pillarSum - 100) <= 0.05 ? '✓ Hợp lệ' : '⚠ Phải bằng 100%'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Nhánh con KPI: Sản phẩm Dịch vụ (VB 469)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_kpi_dv}
                onChange={(e) => setField('w_kpi_dv', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Nhánh con KPI: Huy động vốn (VB 111)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_kpi_hdv}
                onChange={(e) => setField('w_kpi_hdv', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Nhánh con KPI: Dư nợ tín dụng (CT08)</label>
              <input
                type="number" step="0.01" min="0" max="1"
                value={config.w_kpi_dn}
                onChange={(e) => setField('w_kpi_dn', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <div className={`w-full px-3 py-2 rounded-xl text-xs font-bold border ${Math.abs(subKpiSum - 100) <= 0.05 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                Tổng nhánh con KPI: {subKpiSum}% {Math.abs(subKpiSum - 100) <= 0.05 ? '✓ Hợp lệ' : '⚠ Phải bằng 100%'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Phương pháp tổng hợp nhóm Dịch vụ (CT01–CT06)</label>
              <select
                value={config.dv_agg_mode}
                onChange={(e) => setField('dv_agg_mode', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="SIMPLE_AVG">Trung bình cộng đều các chỉ tiêu DV (Chuẩn Excel)</option>
                <option value="WEIGHTED_INDICATORS">Theo Tỷ trọng từng chỉ tiêu trong 2.DM_ChiTieu_GK</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Cơ chế chặn trần KPI (Không bù trừ)</label>
              <select
                value={config.kpi_cap_mode}
                onChange={(e) => setField('kpi_cap_mode', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="GROUP_CAP">Chặn trần 100% ở mức từng Nhóm (Vốn / DV / Dư nợ)</option>
                <option value="INDICATOR_CAP">Chặn trần 100% ở từng Chỉ tiêu con trước khi cộng nhóm</option>
                <option value="UNCAPPED">Không chặn trần 100% (cho phép vượt 100%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Khi cán bộ chưa có dữ liệu chỉ tiêu</label>
              <select
                value={config.missing_kpi_policy}
                onChange={(e) => setField('missing_kpi_policy', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="ZERO">Tính 0% (Chuẩn xác, khắc phục lỗi Excel dòng 20+)</option>
                <option value="FULL_100">Mặc định 100% (Miễn trừ nếu chưa giao)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tỷ lệ giao khoán Gián tiếp / Trực tiếp</label>
              <input
                type="number" step="0.05" min="0" max="2"
                value={config.indirect_target_ratio}
                onChange={(e) => setField('indirect_target_ratio', Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums"
              />
              <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={recalcIndirect} onChange={(e) => setRecalcIndirect(e.target.checked)} />
                Tính lại mức giao Gián tiếp trong Cây chỉ tiêu GK khi lưu
              </label>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
            <strong>Tỷ trọng hiện hành trong Cây chỉ tiêu GK:</strong>{' '}
            {indWeights.map((iw) => `${iw.code}: ${(iw.weight * 100).toFixed(0)}%`).join(' · ')}
            <span className="block mt-1 text-slate-500">(Để sửa tỷ trọng từng mã CT01–CT08, vào Khối 1 → Mục 4: Cây chỉ tiêu giao khoán)</span>
          </div>
        </div>

        {/* Khối Chuyên môn, KSV, Tcv & Tiền lương 3P */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3">
            II. Công thức Chuyên môn (P1/P3), Tcv & Phân phối Lương 3P / V3
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Điểm gốc CM</label>
              <input type="number" value={config.cm_base_score} onChange={(e) => setField('cm_base_score', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trần CM (Max)</label>
              <input type="number" value={config.cm_max_score} onChange={(e) => setField('cm_max_score', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Sàn CM (Min)</label>
              <input type="number" value={config.cm_min_score} onChange={(e) => setField('cm_min_score', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={config.cm_floor_enabled} onChange={(e) => setField('cm_floor_enabled', e.target.checked)} />
                Bật chặn sàn Điểm Chuyên môn ở mức Sàn CM ({config.cm_min_score}đ) thay vì 0đ
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tỷ lệ liên đới KSV</label>
              <input type="number" step="0.05" value={config.ksv_deduction_ratio} onChange={(e) => setField('ksv_deduction_ratio', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trần trừ KSV/tháng</label>
              <input type="number" step="0.5" value={config.ksv_monthly_cap} onChange={(e) => setField('ksv_monthly_cap', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trần trừ tổng (0=KGH)</label>
              <input type="number" step="1" value={config.max_total_deduction} onChange={(e) => setField('max_total_deduction', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tỷ lệ liên đới Phê duyệt</label>
              <input type="number" step="0.05" value={config.approver_deduction_ratio} onChange={(e) => setField('approver_deduction_ratio', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Trần trừ PD/tháng</label>
              <input type="number" step="0.5" value={config.approver_monthly_cap} onChange={(e) => setField('approver_monthly_cap', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Hệ số V2 chung (Kv2)</label>
              <input type="number" step="0.05" value={config.kv2_general} onChange={(e) => setField('kv2_general', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Công thức tính Hệ số Tcv</label>
              <select value={config.tcv_mode} onChange={(e) => setField('tcv_mode', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="LINEAR">Tuyến tính liên tục (Điểm CV/100 + Ưu tiên)</option>
                <option value="TIER_MATRIX">Bậc thang theo Hệ số V2 Tháng (ki) trong Ma trận</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Trần Tcv tối đa</label>
                <input type="number" step="0.05" value={config.tcv_max_cap} onChange={(e) => setField('tcv_max_cap', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Sàn Tcv tối thiểu</label>
                <input type="number" step="0.05" value={config.tcv_min_floor} onChange={(e) => setField('tcv_min_floor', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Nguồn Quỹ V2 tháng</label>
              <select value={config.v2_fund_mode} onChange={(e) => setField('v2_fund_mode', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="MANUAL">Nhập thủ công hạn mức (B17)</option>
                <option value="AUTO_SUM_BASE_V2">Tự động = Tổng V2 gốc nhân sự kỳ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Hạn mức Quỹ V2 tháng (VNĐ)</label>
              <input type="number" step="1000" value={config.v2_monthly_fund} disabled={config.v2_fund_mode === 'AUTO_SUM_BASE_V2'} onChange={(e) => setField('v2_monthly_fund', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums disabled:bg-slate-100" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Nguồn Quỹ Lương Năng suất (QNS)</label>
              <select value={config.qns_mode} onChange={(e) => setField('qns_mode', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="AUTO_SUM_BEFORE_ADJ">Bằng Tổng lương trước ĐC (∑V1+V2, như Excel B20)</option>
                <option value="MONTHS_MULTIPLIER">Nhân số tháng NS × Tổng lương trước ĐC (Điều 12.2)</option>
                <option value="MANUAL">Nhập số tiền QNS cố định</option>
              </select>
            </div>
            {config.qns_mode === 'MONTHS_MULTIPLIER' ? (
              <div>
                <label className="text-xs font-semibold text-slate-600">Số tháng Năng suất</label>
                <input type="number" step="0.1" value={config.qns_months} onChange={(e) => setField('qns_months', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600">Số tiền QNS thủ công (VNĐ)</label>
                <input type="number" step="100000" value={config.qns_manual_amount} disabled={config.qns_mode !== 'MANUAL'} onChange={(e) => setField('qns_manual_amount', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums disabled:bg-slate-100" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600">Tiêu chí phân bổ NSi</label>
              <select value={config.nsi_basis} onChange={(e) => setField('nsi_basis', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="TOTAL_AFTER_ADJ">Theo Tổng lương sau ĐC (V1_tl + V2_sdc)</option>
                <option value="V2_AFTER_ADJ">Chỉ theo Lương V2 sau ĐC</option>
                <option value="KPI_SCORE">Theo Điểm đánh giá công việc</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Công thức Tổng thực lĩnh tháng (Mi)</label>
              <select value={config.monthly_takehome_mode} onChange={(e) => setField('monthly_takehome_mode', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="V1_V2_ONLY">V1_tl + V2_sdc (Chuẩn Excel P = M)</option>
                <option value="INCLUDE_NSI">Nhận theo NSi phân bổ từ QNS</option>
                <option value="V1_V2_PLUS_DIFF">V1_tl + V2_sdc + Chênh lệch NSi</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Phương thức phân bổ Quỹ Thù lao V3</label>
              <select value={config.v3_allocation_method} onChange={(e) => setField('v3_allocation_method', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="V1_PLUS_V2QT">Theo tỷ trọng (Tổng V1 năm + V2 Quyết toán năm)</option>
                <option value="H3_TIME_WEIGHTED">Theo Hệ số V3 (h3) × Tỷ lệ ngày công × (V1+V2)</option>
                <option value="V2QT_ONLY">Chỉ theo tỷ trọng V2 Quyết toán năm</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Mức lương cơ sở Agribank (VNĐ)</label>
              <input type="number" step="10000" value={config.base_salary_agribank} onChange={(e) => setField('base_salary_agribank', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs pt-2">
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={config.use_period_standard_days} onChange={(e) => setField('use_period_standard_days', e.target.checked)} />
              Tự động lấy Ngày công chuẩn theo từng kỳ (TrangThai_Ky)
            </label>
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={config.sync_v3_with_qns} onChange={(e) => setField('sync_v3_with_qns', e.target.checked)} />
              Đồng bộ Quỹ V3 = Quỹ QNS
            </label>
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={config.rounding_residual_to_last} onChange={(e) => setField('rounding_residual_to_last', e.target.checked)} />
              Bù sai số làm tròn V3 vào người cuối (khớp 100% Quỹ)
            </label>
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={config.workday_ratio_cap} onChange={(e) => setField('workday_ratio_cap', e.target.checked)} />
              Chặn trần Tỷ lệ ngày công tối đa 100%
            </label>
          </div>
          {!config.sync_v3_with_qns && (
            <div>
              <label className="text-xs font-semibold text-slate-600">Quỹ Thù lao V3 độc lập (VNĐ)</label>
              <input type="number" step="100000" value={config.v3_fund_amount} onChange={(e) => setField('v3_fund_amount', Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums" />
            </div>
          )}
        </div>
      </div>

      {/* Ma trận thang điểm xếp loại KPI & Khung hệ số */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-3">
          III. Ma trận Thang điểm Xếp loại KPI & Khung Hệ số Lương (Nguồn gốc đồng bộ toàn hệ thống)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="p-3 text-center">Xếp loại</th>
                <th className="p-3 text-right">Điểm sàn (Min ≥)</th>
                <th className="p-3 text-right">Điểm trần (Max)</th>
                <th className="p-3 text-right">Hệ số V2 Tháng (ki)</th>
                <th className="p-3 text-right">Hệ số V2 Quý/Năm (kq)</th>
                <th className="p-3 text-right">Hệ số V3 (h3)</th>
                <th className="p-3 text-left">Mức độ hoàn thành nhiệm vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {tiers.map((t, idx) => (
                <tr key={t.code} className="hover:bg-slate-50">
                  <td className="p-2.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ratingBadgeClass(t.code)}`}>{t.code}</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <input type="number" step="1" value={t.min_score} onChange={(e) => updateTier(idx, 'min_score', Number(e.target.value))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="p-2.5 text-right">
                    <input type="number" step="0.01" value={t.max_score} onChange={(e) => updateTier(idx, 'max_score', Number(e.target.value))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="p-2.5 text-right">
                    <input type="number" step="0.05" value={t.ki_month} onChange={(e) => updateTier(idx, 'ki_month', Number(e.target.value))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="p-2.5 text-right">
                    <input type="number" step="0.05" value={t.kq_settlement} onChange={(e) => updateTier(idx, 'kq_settlement', Number(e.target.value))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold" />
                  </td>
                  <td className="p-2.5 text-right">
                    <input type="number" step="0.05" value={t.h3_v3} onChange={(e) => updateTier(idx, 'h3_v3', Number(e.target.value))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold" />
                  </td>
                  <td className="p-2.5">
                    <input type="text" value={t.description} onChange={(e) => updateTier(idx, 'description', e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
