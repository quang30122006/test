import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { fmtNum } from '../utils/format';
import { useGSAP, runReducedMotionAware, animateSelectionPop, animateTabContentEnter } from '../utils/gsapSetup';
import SlidingTabs from './SlidingTabs';
import { AlertTriangle, Send, Search, ShieldCheck, CheckCircle2, Info } from 'lucide-react';

export default function ViolationFormView({ selectedPeriod, periods, onNavigate, notify, onReloadKsv }) {
  const curPeriod = periods.find((p) => p.period_code === selectedPeriod);
  const isLocked = curPeriod?.status === 'ĐÃ KHÓA';

  const [employees, setEmployees] = useState([]);
  const [ksvCandidates, setKsvCandidates] = useState([]);
  const [rules, setRules] = useState([]);
  const [kpiCodes, setKpiCodes] = useState([]);
  const [cfg, setCfg] = useState({ ksv_deduction_ratio: 0.5, approver_deduction_ratio: 0.25 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [empCode, setEmpCode] = useState('');
  const [pillarType, setPillarType] = useState('3.3'); // 3.1 (Nội quy) | 3.3 (KPI Nghiệp vụ)
  const [codeQuery, setCodeQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [filterByGroup, setFilterByGroup] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [empDeduction, setEmpDeduction] = useState(5);

  const [hasKsvResp, setHasKsvResp] = useState(true);
  const [ksvEmpCode, setKsvEmpCode] = useState('');
  const [ksvProposed, setKsvProposed] = useState(2.5);

  const [hasApproverResp, setHasApproverResp] = useState(false);
  const [approverEmpCode, setApproverEmpCode] = useState('');
  const [approverPoints, setApproverPoints] = useState(1.3);
  const codeListRef = useRef(null);
  const pickedCodeRef = useRef(null);
  const isFirstPillarRef = useRef(true);

  useGSAP(() => {
    if (isFirstPillarRef.current) {
      isFirstPillarRef.current = false;
      return;
    }
    if (!codeListRef.current || loading) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(codeListRef.current, { y: 8, duration: 0.24 });
    });
  }, { dependencies: [pillarType, sourceFilter, loading] });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [empRes, ksvRes, ruleRes, codeRes, cfgRes] = await Promise.all([
          apiFetch('/api/catalogs/employees'),
          apiFetch('/api/catalogs/ksv-candidates'),
          apiFetch('/api/catalogs/internal-rules'),
          apiFetch('/api/catalogs/kpi-error-codes?limit=1200'),
          apiFetch('/api/admin/config'),
        ]);
        const activeEmps = (empRes || []).filter((e) => e.is_active);
        setEmployees(activeEmps);
        setKsvCandidates(ksvRes || []);
        setRules(ruleRes || []);
        setKpiCodes(codeRes.items || []);
        if (cfgRes?.config) setCfg(cfgRes.config);

        if (activeEmps.length > 0) setEmpCode(activeEmps[0].emp_code);
        const firstKsv = (ksvRes || []).find((k) => k.is_ksv) || (ksvRes || [])[0];
        if (firstKsv) {
          setKsvEmpCode(firstKsv.emp_code);
          setApproverEmpCode(firstKsv.emp_code);
        }
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const selectedEmpObj = useMemo(() => employees.find((e) => e.emp_code === empCode), [employees, empCode]);

  const filteredRules = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    return rules.filter(
      (r) => !q || r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.group_name.toLowerCase().includes(q)
    );
  }, [rules, codeQuery]);

  const filteredKpiCodes = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    return kpiCodes
      .filter((c) => {
        if (sourceFilter !== 'ALL' && c.source_type !== sourceFilter) return false;
        if (filterByGroup && selectedEmpObj && c.applicable_groups) {
          const allowed = c.applicable_groups.split(',').map((x) => x.trim());
          if (!allowed.includes(String(selectedEmpObj.group_id))) return false;
        }
        if (q && !c.code.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.scope.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .slice(0, 80);
  }, [kpiCodes, codeQuery, sourceFilter, filterByGroup, selectedEmpObj]);

  const syncDeductionDerived = (pts) => {
    const v = Math.abs(Number(pts || 0));
    setEmpDeduction(v);
    setKsvProposed(Number((v * (cfg.ksv_deduction_ratio ?? 0.5)).toFixed(1)));
    setApproverPoints(Number((v * (cfg.approver_deduction_ratio ?? 0.25)).toFixed(1)));
  };

  const pickRule = (r) => {
    setErrorCode(r.code);
    setErrorDetail(r.description);
    syncDeductionDerived(Math.abs(r.points));
    if (pickedCodeRef.current) animateSelectionPop(pickedCodeRef.current, 0.95);
  };

  const pickKpiCode = (c) => {
    setErrorCode(c.code);
    setErrorDetail(c.description);
    syncDeductionDerived(Math.abs(c.points));
    if (pickedCodeRef.current) animateSelectionPop(pickedCodeRef.current, 0.95);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empCode || !errorCode.trim() || !errorDetail.trim()) {
      notify('Vui lòng chọn cán bộ, mã lỗi và nội dung vi phạm', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/operations/violations', {
        method: 'POST',
        body: JSON.stringify({
          period_code: selectedPeriod,
          emp_code: empCode,
          pillar_type: pillarType,
          error_code: errorCode.trim(),
          error_detail: errorDetail.trim(),
          emp_deduction: Math.abs(Number(empDeduction)),
          has_ksv_resp: hasKsvResp,
          ksv_emp_code: hasKsvResp ? ksvEmpCode : '',
          ksv_proposed_points: hasKsvResp ? Number(ksvProposed) : 0,
          has_approver_resp: hasApproverResp,
          approver_emp_code: hasApproverResp ? approverEmpCode : '',
          approver_points: hasApproverResp ? Number(approverPoints) : 0,
        }),
      });
      notify(res.message || 'Đã ghi nhận biên bản vi phạm');
      if (onReloadKsv) onReloadKsv();
      onNavigate('violation_log');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            KHỐI 2 · MỤC 2.5 · FORM GHI NHẬN VI PHẠM CHUẨN HÓA (P1 / P3)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Lập biên bản Ghi nhận vi phạm & Liên đới KSV — {curPeriod?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Khắc phục hoàn toàn lỗi đọc nhầm cột và bỏ sót mã NQ của Excel: tự động tra cứu đủ 16 Nội quy + 1.118 Bộ mã KPI & tách bạch điểm CB · KSV · Phê duyệt.
          </p>
        </div>

        <button
          onClick={() => onNavigate('violation_log')}
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer self-start"
        >
          Xem Nhật ký lỗi &rarr;
        </button>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Kỳ {curPeriod?.period_name} đã khóa sổ. Không thể tạo biên bản vi phạm mới cho kỳ này.
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-200">Đang tải danh mục lỗi & nội quy...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Bên trái: Tra cứu & Chọn nhanh mã lỗi */}
          <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-sm">1. Chọn Trụ cột & Kho mã lỗi chuẩn</div>
              <SlidingTabs
                items={[
                  { id: '3.1', label: `P1: Nội quy (${rules.length})` },
                  { id: '3.3', label: `P3: KPI Nghiệp vụ (${kpiCodes.length})` },
                ]}
                value={pillarType}
                onChange={(val) => { setPillarType(val); setCodeQuery(''); }}
                className="flex rounded-lg bg-slate-800 border border-slate-700 p-0.5 text-xs"
                buttonClassName="px-3 py-1 rounded-md text-xs font-bold"
                pillClassName="bg-[#9E1B32] shadow-xs rounded-md"
                inactiveTextClass="text-slate-300 hover:text-white"
              />
            </div>

            <div className="p-4 border-b border-slate-100 space-y-2.5 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder={pillarType === '3.1' ? 'Tìm mã NQ (VD: NQ01, NQ05) hoặc hành vi nội quy...' : 'Tìm mã KPI (VD: GDV, TD, KT, PL3...) hoặc từ khóa...'}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:border-[#9E1B32]"
                />
              </div>

              {pillarType === '3.3' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ALL">Tất cả nguồn (290 PL3 + 828 MR)</option>
                    <option value="PHU_LUC_3">Phụ lục 3 chuẩn (290)</option>
                    <option value="GOI_Y_MO_RONG">Bộ mã gợi ý mở rộng (828)</option>
                  </select>

                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterByGroup}
                      onChange={(e) => setFilterByGroup(e.target.checked)}
                    />
                    Chỉ lọc theo Nhóm {selectedEmpObj?.group_id || 'CB'}
                  </label>
                </div>
              )}
            </div>

            <div ref={codeListRef} className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto flex-1">
              {pillarType === '3.1'
                ? filteredRules.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => pickRule(r)}
                      className={`w-full text-left px-4 py-3 hover:bg-rose-50/70 transition cursor-pointer flex items-start justify-between gap-3 ${
                        errorCode === r.code ? 'bg-rose-50 ring-1 ring-inset ring-rose-300' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white">{r.code}</span>
                          <span className="text-[11px] font-semibold text-amber-700">{r.group_name}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-800 font-medium mt-1">{r.description}</div>
                      </div>
                      <span className="shrink-0 font-bold text-sm text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                        -{Math.abs(r.points)}đ
                      </span>
                    </button>
                  ))
                : filteredKpiCodes.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => pickKpiCode(c)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-rose-50/70 transition cursor-pointer flex items-start justify-between gap-3 ${
                        errorCode === c.code ? 'bg-rose-50 ring-1 ring-inset ring-rose-300' : ''
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white">{c.code}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{c.level_name}</span>
                          {c.scope && <span className="text-[11px] text-slate-400">{c.scope}</span>}
                        </div>
                        <div className="text-xs text-slate-800 mt-1 line-clamp-2">{c.description}</div>
                      </div>
                      <span className="shrink-0 font-bold text-xs sm:text-sm text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                        -{Math.abs(c.points)}đ
                      </span>
                    </button>
                  ))}
            </div>
          </div>

          {/* Bên phải: Hoàn tất biên bản & Liên đới */}
          <form onSubmit={handleSubmit} className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[#9E1B32] text-white px-5 py-3 font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 2. Chi tiết Biên bản & Liên đới trách nhiệm
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cán bộ thực hiện / vi phạm</label>
                  <select
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-semibold outline-none focus:border-[#9E1B32]"
                  >
                    {employees.map((e) => (
                      <option key={e.emp_code} value={e.emp_code}>
                        {e.full_name} — {e.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trụ cột áp dụng điểm trừ</label>
                  <select
                    value={pillarType}
                    onChange={(e) => setPillarType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-semibold outline-none focus:border-[#9E1B32]"
                  >
                    <option value="3.1">3.1 — Điểm trừ Nội quy & Kỷ luật (P1)</option>
                    <option value="3.3">3.3 — Điểm trừ KPI Nghiệp vụ (P3)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div ref={pickedCodeRef}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã lỗi</label>
                  <input
                    type="text"
                    value={errorCode}
                    onChange={(e) => setErrorCode(e.target.value)}
                    placeholder="VD: PL3_005 hoặc NQ01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold outline-none focus:border-[#9E1B32]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Điểm trừ trực tiếp (Cán bộ vi phạm)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={empDeduction}
                      onChange={(e) => syncDeductionDerived(e.target.value)}
                      className="w-32 px-3 py-2 border border-rose-300 rounded-xl text-sm font-extrabold text-rose-700 outline-none focus:border-[#9E1B32]"
                    />
                    <span className="text-xs text-slate-500">điểm (số dương, hệ thống tự trừ khỏi Điểm CM)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả chi tiết hành vi / hồ sơ vi phạm</label>
                <textarea
                  rows={3}
                  value={errorDetail}
                  onChange={(e) => setErrorDetail(e.target.value)}
                  placeholder="Chọn mã bên trái để tự động điền hoặc nhập mô tả chi tiết..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-[#9E1B32]"
                />
              </div>

              {/* Liên đới KSV */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> Liên đới Kiểm soát viên ({((cfg.ksv_deduction_ratio ?? 0.5) * 100).toFixed(0)}%, chờ KSV xác nhận)
                  </span>
                  <input
                    type="checkbox"
                    checked={hasKsvResp}
                    onChange={(e) => setHasKsvResp(e.target.checked)}
                    className="w-4 h-4 accent-[#9E1B32]"
                  />
                </label>

                {hasKsvResp && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="sm:col-span-2">
                      <select
                        value={ksvEmpCode}
                        onChange={(e) => setKsvEmpCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white font-semibold"
                      >
                        {ksvCandidates.map((k) => (
                          <option key={k.emp_code} value={k.emp_code}>
                            {k.full_name} {k.is_ksv ? '★ (KSV)' : ''} — {k.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={ksvProposed}
                        onChange={(e) => setKsvProposed(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white font-bold text-amber-800 text-right"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Liên đới Người phê duyệt */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-slate-800">
                    Liên đới Người phê duyệt ({((cfg.approver_deduction_ratio ?? 0.25) * 100).toFixed(0)}%)
                  </span>
                  <input
                    type="checkbox"
                    checked={hasApproverResp}
                    onChange={(e) => setHasApproverResp(e.target.checked)}
                    className="w-4 h-4 accent-[#9E1B32]"
                  />
                </label>

                {hasApproverResp && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="sm:col-span-2">
                      <select
                        value={approverEmpCode}
                        onChange={(e) => setApproverEmpCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                      >
                        {ksvCandidates.map((k) => (
                          <option key={k.emp_code} value={k.emp_code}>
                            {k.full_name} — {k.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={approverPoints}
                        onChange={(e) => setApproverPoints(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold text-right"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  Nếu bật Liên đới KSV, điểm KSV sẽ nằm ở trạng thái <strong>PENDING</strong> trong Hàng chờ KSV cho tới khi Admin hoặc KSV đó bấm Chấp nhận (APPROVED). Điểm trực tiếp CB áp dụng ngay.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLocked || submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Đang ghi nhận...' : `Ghi nhận vi phạm (-${fmtNum(empDeduction, 1)} điểm CM)`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
