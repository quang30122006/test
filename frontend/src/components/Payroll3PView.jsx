import React, { useEffect, useState } from 'react';
import { apiFetch, apiDownload } from '../api';
import { fmtMoney, fmtNum, ratingBadgeClass } from '../utils/format';
import { Download, Printer, Wallet } from 'lucide-react';

export default function Payroll3PView({ selectedPeriod, onNavigate, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payroll/bang-luong-3p?period_code=${encodeURIComponent(selectedPeriod)}`);
      setData(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedPeriod]);

  const rows = data?.payroll_rows || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            KHỐI 3 · MỤC 3.2 · BẢNG THANH TOÁN LƯƠNG 3P (BangLuong_3P)
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Bảng Thanh Toán Tiền Lương 3P — {data?.period_name || selectedPeriod}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tổng hợp Lương V1 theo ngày công, Lương V2 theo hiệu quả KPI & điều tiết QNS. Bằng chữ: <span className="italic font-semibold text-slate-700">{totals.takehome_in_words || '—'}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('print_reports', { tab: 'v2' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-sky-600" /> In Bảng V2 (02/TL-V2)
          </button>
          <button
            onClick={() => apiDownload(`/api/payroll/export-excel?period_code=${selectedPeriod}`, `BangLuong_3P_${selectedPeriod}.xlsx`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" /> Xuất Excel Tổng hợp
          </button>
        </div>
      </div>

      {/* Thẻ tổng hợp quỹ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">V1 thực lĩnh theo công</div>
          <div className="text-lg sm:text-xl font-extrabold text-sky-700 mt-1">{fmtMoney(totals.v1_actual)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">V2 theo hiệu quả (KPI)</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#9E1B32] mt-1">{fmtMoney(totals.v2_adj)} đ</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Quỹ V2 tháng: {fmtMoney(totals.v2_monthly_fund)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold">Phân bổ Quỹ QNS (NSi)</div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1">{fmtMoney(totals.nsi)} đ</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Quỹ QNS: {fmtMoney(totals.qns_fund)} đ</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-xs text-emerald-800 font-bold">Tổng Thực nhận Tháng</div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-900 mt-1">{fmtMoney(totals.takehome)} đ</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Chênh lệch V2 còn dư: {fmtMoney(totals.v2_surplus)} đ</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white uppercase">
              <tr>
                <th className="px-3 py-3">Cán bộ</th>
                <th className="px-3 py-3 text-right">ĐM V1</th>
                <th className="px-3 py-3 text-right">ĐM V2</th>
                <th className="px-3 py-3 text-right">Công (TT/C)</th>
                <th className="px-3 py-3 text-right">Điểm CV / TCV</th>
                <th className="px-3 py-3 text-center">Loại</th>
                <th className="px-3 py-3 text-right">V1 Thực lĩnh</th>
                <th className="px-3 py-3 text-right">V2 Thực hưởng</th>
                <th className="px-3 py-3 text-right">Tổng (V1+V2)</th>
                <th className="px-3 py-3 text-right">QNS (NSi)</th>
                <th className="px-3 py-3 text-right">Chênh NSi</th>
                <th className="px-3 py-3 text-right bg-[#9E1B32]">Thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">Đang lập bảng lương 3P...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Chưa có dữ liệu bảng lương trong kỳ này.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.emp_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => onNavigate('print_reports', { tab: 'payslip', empCode: r.emp_code })}
                        className="text-left group cursor-pointer"
                        title="Xem nhanh phiếu lương cá nhân"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-[#9E1B32] group-hover:underline">{r.full_name}</div>
                        <div className="text-[11px] text-slate-400">{r.title}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(r.base_v1)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(r.base_v2)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="font-semibold">{fmtNum(r.actual_workdays, 1)}</span>
                      <span className="text-slate-400">/{fmtNum(r.standard_workdays, 0)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <div className="font-bold text-slate-800">{fmtNum(r.work_score, 2)}</div>
                      <div className="text-[11px] text-[#9E1B32] font-semibold">{(r.tcv * 100).toFixed(1)}%</div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${ratingBadgeClass(r.rating)}`}>
                        {r.rating}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-sky-700">{fmtMoney(r.v1_actual)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#9E1B32]">{fmtMoney(r.v2_adj)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">{fmtMoney(r.total_after)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-semibold">{fmtMoney(r.nsi)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.diff_ns >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {r.diff_ns > 0 ? `+${fmtMoney(r.diff_ns)}` : fmtMoney(r.diff_ns)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-emerald-900 bg-emerald-50/60">
                      {fmtMoney(r.takehome)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                <tr>
                  <td className="px-3 py-3">TỔNG CỘNG ({rows.length} CB)</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.base_v1)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.base_v2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtNum(totals.workdays, 1)}</td>
                  <td colSpan={2} className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500">
                    TB TCV & Hạng
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sky-800">{fmtMoney(totals.v1_actual)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#9E1B32]">{fmtMoney(totals.v2_adj)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.total_after)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-800">{fmtMoney(totals.nsi)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(totals.diff_ns)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-900 bg-emerald-100">{fmtMoney(totals.takehome)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

