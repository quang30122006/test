import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum } from '../utils/format';
import { Target, Save, Filter, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ExecutionTargetsView({ selectedPeriod, periods, notify }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';
  const [rows, setRows] = useState([]);
  const [kpiSummary, setKpiSummary] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [execRes, kpiRes] = await Promise.all([
        apiFetch(`/api/operations/targets-execution?period_code=${encodeURIComponent(selectedPeriod)}`),
        apiFetch(`/api/payroll/kpi-month?period_code=${encodeURIComponent(selectedPeriod)}`),
      ]);
      setRows(execRes.rows || []);
      setKpiSummary(kpiRes.rows || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const handleFieldChange = (r, field, val) => {
    const key = `${r.emp_code}__${r.indicator_code}`;
    setEdits((prev) => ({
      ...prev,
      [key]: {
        target_value: prev[key]?.target_value ?? r.target_value,
        actual_value: prev[key]?.actual_value ?? r.actual_value,
        [field]: val,
      },
    }));
  };

  const saveOne = async (r) => {
    const key = `${r.emp_code}__${r.indicator_code}`;
    const d = edits[key] || { target_value: r.target_value, actual_value: r.actual_value };
    setSavingKey(key);
    try {
      await apiFetch(`/api/operations/targets-execution?period_code=${encodeURIComponent(selectedPeriod)}`, {
        method: 'PUT',
        body: JSON.stringify({
          emp_code: r.emp_code,
          indicator_code: r.indicator_code,
          target_value: Number(d.target_value),
          actual_value: Number(d.actual_value),
        }),
      });
      notify(`Đã cập nhật ${r.indicator_code} — ${r.full_name}`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const employeesList = kpiSummary.map((k) => ({ emp_code: k.emp_code, full_name: k.full_name, department: k.department }));

  const filtered = rows.filter((r) => {
    if (selectedEmp !== 'ALL' && r.emp_code !== selectedEmp) return false;
    if (branchFilter !== 'ALL' && r.kpi_branch !== branchFilter) return false;
    return true;
  });

  const activeKpiRow = selectedEmp !== 'ALL' ? kpiSummary.find((k) => k.emp_code === selectedEmp) : null;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.4 · KẾT QUẢ THỰC HIỆN GIAO KHOÁN TRỤ CỘT P2 (Nhap_ThucHien)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Nhập & Chấm điểm thực hiện 8 Chỉ tiêu Giao khoán — {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Điền trực tiếp số liệu Thực hiện (Ai) và Mục tiêu (Ti). Hệ thống tự động quy đổi Tỷ lệ hoàn thành Ci = Ai/Ti, Điểm chuẩn Si và điểm 3 nhánh HDV / DV / DN.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="w-4 h-4 text-slate-400" /> Chọn cán bộ:
          </div>
          <select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-semibold outline-none focus:border-[#9E1B32]"
          >
            <option value="ALL">Tất cả cán bộ ({employeesList.length})</option>
            {employeesList.map((e) => (
              <option key={e.emp_code} value={e.emp_code}>
                {e.full_name} ({e.emp_code})
              </option>
            ))}
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:border-[#9E1B32]"
          >
            <option value="ALL">Cả 3 nhánh (HDV · DV · DN)</option>
            <option value="HDV">Huy động vốn (HDV)</option>
            <option value="DV">Dịch vụ (DV)</option>
            <option value="DN">Dư nợ (DN)</option>
          </select>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Chỉ cho phép tra cứu, không chỉnh sửa Ai / Ti.
        </div>
      )}

      {activeKpiRow && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
            <div className="text-xs text-slate-500">Nhánh Huy động vốn (HDV)</div>
            <div className="text-xl font-extrabold text-sky-700 mt-1">{fmtNum(activeKpiRow.pct_hdv, 2)} điểm</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
            <div className="text-xs text-slate-500">Nhánh Dịch vụ (DV)</div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">{fmtNum(activeKpiRow.pct_dv, 2)} điểm</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
            <div className="text-xs text-slate-500">Nhánh Dư nợ (DN)</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">{fmtNum(activeKpiRow.pct_dn, 2)} điểm</div>
          </div>
          <div className="bg-rose-50 rounded-xl border border-rose-200 p-3.5 shadow-sm">
            <div className="text-xs font-bold text-[#9E1B32]">Tổng điểm Trụ cột P2 (KPI)</div>
            <div className="text-xl font-extrabold text-[#9E1B32] mt-1">{fmtNum(activeKpiRow.kpi_score, 2)} điểm</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-900 text-white text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3">Cán bộ</th>
                <th className="px-3 py-3">Nhánh</th>
                <th className="px-3 py-3">Chỉ tiêu GK</th>
                <th className="px-3 py-3 text-right">Trọng số wi</th>
                <th className="px-3 py-3 text-right">Mục tiêu Ti</th>
                <th className="px-3 py-3 text-right">Thực hiện Ai</th>
                <th className="px-3 py-3 text-right">Tỷ lệ Ci = Ai/Ti</th>
                <th className="px-3 py-3 text-right">Điểm Si</th>
                <th className="px-3 py-3 text-right">wi × Si</th>
                <th className="px-3 py-3 text-center">Lưu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">Đang tính toán kết quả giao khoán...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Chưa có số liệu thực hiện chỉ tiêu trong kỳ này.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const key = `${r.emp_code}__${r.indicator_code}`;
                  const dirty = Boolean(edits[key]);
                  const tVal = edits[key]?.target_value ?? r.target_value;
                  const aVal = edits[key]?.actual_value ?? r.actual_value;
                  return (
                    <tr key={key} className={`hover:bg-slate-50 ${dirty ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900">{r.full_name}</div>
                        <div className="text-[11px] text-slate-400">{r.department} · {r.labor_type}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.kpi_branch === 'HDV' ? 'bg-sky-100 text-sky-800'
                          : r.kpi_branch === 'DV' ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.kpi_branch}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-800">{r.indicator_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.indicator_code} ({r.unit})</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{(r.weight_wi * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={isLocked}
                          value={tVal}
                          onChange={(e) => handleFieldChange(r, 'target_value', e.target.value)}
                          className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right text-xs tabular-nums focus:border-[#9E1B32] outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={isLocked}
                          value={aVal}
                          onChange={(e) => handleFieldChange(r, 'actual_value', e.target.value)}
                          className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right text-xs font-bold text-[#9E1B32] tabular-nums focus:border-[#9E1B32] outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={`font-semibold ${r.ratio_ci >= 1 ? 'text-emerald-700' : r.ratio_ci >= 0.8 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {(r.ratio_ci * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800">{fmtNum(r.score_si, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-sky-700">{fmtNum(r.weighted_score, 2)}</td>
                      <td className="px-3 py-2 text-center">
                        {isLocked ? (
                          <span className="text-slate-300">—</span>
                        ) : dirty ? (
                          <button
                            onClick={() => saveOne(r)}
                            disabled={savingKey === key}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#9E1B32] hover:bg-[#801427] text-white text-xs font-bold shadow-sm cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> Lưu
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-emerald-600 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Khớp
                          </span>
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

