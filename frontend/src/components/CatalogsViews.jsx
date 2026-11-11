import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, KeyRound, Search, Edit3, X, Printer } from 'lucide-react';
import { apiFetch } from '../api';
import { fmtMoney, fmtNum } from '../utils/format';

const GROUP_OPTIONS = [
  { id: 1, label: 'Nhóm 1 - Giao dịch viên trực tiếp khách hàng' },
  { id: 2, label: 'Nhóm 2 - Kế toán & Giao dịch viên nội bộ' },
  { id: 3, label: 'Nhóm 3 - Cán bộ hậu kiểm' },
  { id: 4, label: 'Nhóm 4 - Thủ quỹ & Ngân quỹ kho quỹ' },
  { id: 5, label: 'Nhóm 5 - Kiểm soát viên & Lãnh đạo phòng' },
  { id: 6, label: 'Nhóm 6 - Cán bộ Tín dụng & QLKH' },
];

export function EmployeesCatalogView({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [form, setForm] = useState({
    emp_code: '', full_name: '', title: '', department: 'Phòng KTNQ',
    group_id: 1, labor_type: 'Trực tiếp', hsl_v1: 1.9, pccv: 0, base_v1: 0, base_v2: 5000000, is_ksv: false, is_active: true,
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const data = await apiFetch('/api/catalogs/employees?include_inactive=true');
    setRows(data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setIsNew(true);
    setForm({
      emp_code: '', full_name: '', title: 'Giao dịch viên', department: 'Phòng KTNQ',
      group_id: 1, labor_type: 'Trực tiếp', hsl_v1: 1.9, pccv: 0, base_v1: 8987000, base_v2: 5000000, is_ksv: false, is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setIsNew(false);
    setForm({ ...r });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      if (isNew) {
        await apiFetch('/api/catalogs/employees', { method: 'POST', body: JSON.stringify(form) });
        setMsg(`Đã thêm cán bộ ${form.full_name}`);
      } else {
        await apiFetch(`/api/catalogs/employees/${form.emp_code}`, { method: 'PUT', body: JSON.stringify(form) });
        setMsg(`Đã cập nhật cán bộ ${form.full_name}`);
      }
      setModalOpen(false);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const handleResetPw = async (empCode) => {
    const res = await apiFetch(`/api/catalogs/employees/${empCode}/reset-password`, { method: 'POST' });
    setMsg(res.message);
  };

  const filtered = rows.filter((r) =>
    `${r.emp_code} ${r.full_name} ${r.title} ${r.department}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">1. Danh mục Cán bộ & Định mức Lương 3P (1.DM_CanBo)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quản lý hồ sơ chuẩn, phân nhóm nghiệp vụ 1..6, phân loại Trực tiếp/Gián tiếp & mật khẩu cổng Cán bộ.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã / tên cán bộ..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm" />
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-sm font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Thêm cán bộ
          </button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}
      {err && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{err}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Mã CB</th>
                <th className="p-3 text-left">Họ và tên</th>
                <th className="p-3 text-left">Chức danh / Phòng</th>
                <th className="p-3 text-left">Nhóm NV</th>
                <th className="p-3 text-center">Phân loại</th>
                <th className="p-3 text-right">HSL V1</th>
                <th className="p-3 text-right">Lương V1 CB</th>
                <th className="p-3 text-right">Mức V2 gốc</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filtered.map((r) => (
                <tr key={r.emp_code} className={`hover:bg-slate-50 ${!r.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-3 font-mono font-semibold">{r.emp_code}</td>
                  <td className="p-3 font-semibold text-slate-900">
                    {r.full_name}
                    {r.is_ksv && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">KSV</span>}
                  </td>
                  <td className="p-3 text-slate-600">{r.title} · {r.department}</td>
                  <td className="p-3 text-xs text-slate-600">{r.group_name}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.labor_type === 'Trực tiếp' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                      {r.labor_type}
                    </span>
                  </td>
                  <td className="p-3 text-right">{fmtNum(r.hsl_v1, 2)}</td>
                  <td className="p-3 text-right font-medium">{fmtMoney(r.base_v1)}</td>
                  <td className="p-3 text-right font-semibold text-[#9E1B32]">{fmtMoney(r.base_v2)}</td>
                  <td className="p-3 text-right whitespace-nowrap space-x-1">
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('payslip_admin', { empCode: r.emp_code })}
                        title="Xem thông tin chi tiết & In hồ sơ/phiếu lương A4"
                        className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 inline" /> Xem & In
                      </button>
                    )}
                    <button onClick={() => openEdit(r)} className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5 inline" /> Sửa
                    </button>
                    <button onClick={() => handleResetPw(r.emp_code)} title="Đặt lại mật khẩu về 123456" className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer">
                      <KeyRound className="w-3.5 h-3.5 inline" /> Reset MK
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg">{isNew ? 'Thêm Cán bộ mới' : `Chỉnh sửa: ${form.full_name}`}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">Mã Cán bộ *</label>
                <input required disabled={!isNew} value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Họ và tên *</label>
                <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Chức danh</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Phòng ban</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Nhóm nghiệp vụ</label>
                <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  {GROUP_OPTIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Phân loại lao động</label>
                <select value={form.labor_type} onChange={(e) => setForm({ ...form, labor_type: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  <option value="Trực tiếp">Trực tiếp</option>
                  <option value="Gián tiếp">Gián tiếp</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Hệ số V1</label>
                <input type="number" step="0.01" value={form.hsl_v1} onChange={(e) => setForm({ ...form, hsl_v1: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Lương cơ bản V1 (VNĐ)</label>
                <input type="number" step="1000" value={form.base_v1} onChange={(e) => setForm({ ...form, base_v1: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Mức Lương V2 gốc (VNĐ)</label>
                <input type="number" step="1000" value={form.base_v2} onChange={(e) => setForm({ ...form, base_v2: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div className="flex items-center gap-4 pt-5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={form.is_ksv} onChange={(e) => setForm({ ...form, is_ksv: e.target.checked })} /> Có quyền KSV
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Đang công tác
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer">Hủy</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#9E1B32] text-white font-semibold cursor-pointer">Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function IndicatorsCatalogView({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [newRow, setNewRow] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => setRows(await apiFetch('/api/catalogs/indicators'));
  useEffect(() => { load(); }, []);

  const totalWeight = rows.reduce((s, r) => s + Number(editing[r.code]?.weight ?? r.weight), 0);

  const handleSave = async (r) => {
    setErr(''); setMsg('');
    const ed = editing[r.code] || {};
    try {
      await apiFetch(`/api/catalogs/indicators/${r.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: r.code,
          category: ed.category ?? r.category,
          kpi_branch: ed.kpi_branch ?? r.kpi_branch,
          name: ed.name ?? r.name,
          unit: ed.unit ?? r.unit,
          weight: Number(ed.weight ?? r.weight),
          target_direct: Number(ed.target_direct ?? r.target_direct),
          target_indirect: ed.target_indirect !== undefined ? Number(ed.target_indirect) : undefined,
        }),
      });
      setMsg(`Đã lưu chỉ tiêu ${r.code}`);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await apiFetch('/api/catalogs/indicators', { method: 'POST', body: JSON.stringify(newRow) });
      setNewRow(null);
      setMsg('Đã thêm chỉ tiêu mới');
      await load();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">2. Cây Chỉ tiêu Giao khoán Kinh doanh (2.DM_ChiTieu_GK)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng tỷ trọng hiện tại: <strong className={Math.abs(totalWeight - 1) < 0.001 ? 'text-emerald-700' : 'text-rose-700'}>{(totalWeight * 100).toFixed(1)}%</strong>
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setNewRow({ code: 'CT09', category: '3.3.1 Dịch vụ', kpi_branch: 'DV', name: '', unit: 'khách hàng', weight: 0, target_direct: 10 })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] text-white text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm chỉ tiêu
          </button>
        )}
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}
      {err && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{err}</div>}

      {newRow && !readOnly && (
        <form onSubmit={handleCreate} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-6 gap-2 text-sm">
          <input required placeholder="Mã (CT09)" value={newRow.code} onChange={(e) => setNewRow({ ...newRow, code: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <select value={newRow.kpi_branch} onChange={(e) => setNewRow({ ...newRow, kpi_branch: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white">
            <option value="DV">Nhóm Dịch vụ (DV)</option>
            <option value="HDV">Huy động vốn (HDV)</option>
            <option value="DN">Dư nợ (DN)</option>
          </select>
          <input required placeholder="Tên chỉ tiêu" value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 bg-white" />
          <input placeholder="ĐVT" value={newRow.unit} onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <div className="flex gap-1">
            <button type="submit" className="flex-1 bg-[#9E1B32] text-white rounded-lg font-semibold px-3 py-1.5 cursor-pointer">Tạo</button>
            <button type="button" onClick={() => setNewRow(null)} className="px-2 rounded-lg border bg-white cursor-pointer">Hủy</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Mã CT</th>
                <th className="p-3 text-left">Nhóm / Nhánh</th>
                <th className="p-3 text-left">Tên chỉ tiêu kinh doanh</th>
                <th className="p-3 text-center">ĐVT</th>
                <th className="p-3 text-right">Tỷ trọng (0–1)</th>
                <th className="p-3 text-right">Mức giao Năm (Trực tiếp)</th>
                <th className="p-3 text-right">Mức giao Năm (Gián tiếp)</th>
                {!readOnly && <th className="p-3 text-right">Lưu</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => {
                const ed = editing[r.code] || {};
                return (
                  <tr key={r.code} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-[#9E1B32]">{r.code}</td>
                    <td className="p-3 text-xs text-slate-600">{r.category} ({r.kpi_branch})</td>
                    <td className="p-3 font-medium">
                      {readOnly ? r.name : (
                        <input value={ed.name ?? r.name} onChange={(e) => setEditing((p) => ({ ...p, [r.code]: { ...p[r.code], name: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                      )}
                    </td>
                    <td className="p-3 text-center text-slate-600">{r.unit}</td>
                    <td className="p-3 text-right">
                      {readOnly ? `${(r.weight * 100).toFixed(1)}%` : (
                        <input type="number" step="0.01" value={ed.weight ?? r.weight} onChange={(e) => setEditing((p) => ({ ...p, [r.code]: { ...p[r.code], weight: e.target.value } }))} className="w-20 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {readOnly ? fmtNum(r.target_direct) : (
                        <input type="number" step="0.1" value={ed.target_direct ?? r.target_direct} onChange={(e) => setEditing((p) => ({ ...p, [r.code]: { ...p[r.code], target_direct: e.target.value } }))} className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-sky-700">{fmtNum(r.target_indirect)}</td>
                    {!readOnly && (
                      <td className="p-3 text-right">
                        <button onClick={() => handleSave(r)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#9E1B32] hover:text-white text-slate-700 text-xs font-semibold cursor-pointer">
                          <Save className="w-3.5 h-3.5 inline mr-1" />Lưu
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function InternalRulesCatalogView({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [newRule, setNewRule] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => setRows(await apiFetch('/api/catalogs/internal-rules'));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await apiFetch('/api/catalogs/internal-rules', { method: 'POST', body: JSON.stringify(newRule) });
    setNewRule(null);
    setMsg('Đã thêm mã nội quy');
    await load();
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Xóa mã nội quy ${code}?`)) return;
    await apiFetch(`/api/catalogs/internal-rules/${code}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Danh mục Nội quy, Kỷ luật Lao động & Văn hóa Agribank (DM_NOI_QUY)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Áp dụng cho Trụ cột 3.1 (P1) — Bao gồm đầy đủ 16+ mã từ I.01 đến III.11 và NQ01–NQ05.</p>
        </div>
        {!readOnly && (
          <button onClick={() => setNewRule({ code: '', group_name: 'I. Giao dịch & Phục vụ KH', description: '', points: -2, criteria: '3.1 Nội quy', note: '' })} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9E1B32] text-white text-sm font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Thêm quy định
          </button>
        )}
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      {newRule && !readOnly && (
        <form onSubmit={handleCreate} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-2 text-sm">
          <input required placeholder="Mã (VD: NQ06)" value={newRule.code} onChange={(e) => setNewRule({ ...newRule, code: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <input required placeholder="Nhóm quy chế" value={newRule.group_name} onChange={(e) => setNewRule({ ...newRule, group_name: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <input required placeholder="Mô tả hành vi vi phạm" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 bg-white" />
          <div className="flex gap-1">
            <input type="number" step="0.5" placeholder="Điểm" value={newRule.points} onChange={(e) => setNewRule({ ...newRule, points: Number(e.target.value) })} className="w-20 rounded-lg border px-2 py-1.5 bg-white" />
            <button type="submit" className="bg-[#9E1B32] text-white rounded-lg px-3 font-semibold cursor-pointer">Thêm</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Mã</th>
                <th className="p-3 text-left">Nhóm quy chế</th>
                <th className="p-3 text-left">Chi tiết hành vi vi phạm</th>
                <th className="p-3 text-center">Mức trừ</th>
                <th className="p-3 text-left">Ghi chú</th>
                {!readOnly && <th className="p-3 text-right">Xóa</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-[#9E1B32] whitespace-nowrap">{r.code}</td>
                  <td className="p-3 text-xs font-semibold text-slate-600">{r.group_name}</td>
                  <td className="p-3 text-slate-800">{r.description}</td>
                  <td className="p-3 text-center font-bold text-rose-700 tabular-nums">{r.points}đ</td>
                  <td className="p-3 text-xs text-slate-500">{r.note}</td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      <button onClick={() => handleDelete(r.code)} className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function KpiErrorTreeCatalogView({ readOnly = false }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sourceType, setSourceType] = useState('PHU_LUC_3');
  const [levelName, setLevelName] = useState('ALL');
  const [q, setQ] = useState('');
  const [newCode, setNewCode] = useState(null);

  const load = async () => {
    const params = new URLSearchParams({ source_type: sourceType, level_name: levelName, q, limit: '500' });
    const res = await apiFetch(`/api/catalogs/kpi-error-codes?${params.toString()}`);
    setItems(res.items || []);
    setTotal(res.total_matched || 0);
  };

  useEffect(() => { load(); }, [sourceType, levelName, q]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await apiFetch('/api/catalogs/kpi-error-codes', { method: 'POST', body: JSON.stringify(newCode) });
    setNewCode(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Bộ mã KPI Nghiệp vụ P3 (CAY_KPI_NGHIEP_VU)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đầy đủ <strong>290 mã Phụ lục 3</strong> (Mức I–V: -1đ đến -10đ) & <strong>828 mã gợi ý mở rộng</strong> (HS, HT, GD, HK, KQ...). Đang hiện {total} mã.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white font-semibold">
            <option value="PHU_LUC_3">Phụ lục 3 (290 mã chuẩn)</option>
            <option value="GOI_Y_MO_RONG">Danh mục gợi ý mở rộng (828 mã)</option>
            <option value="ALL">Tất cả (1.118 mã)</option>
          </select>
          <select value={levelName} onChange={(e) => setLevelName(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="ALL">Mọi cấp độ</option>
            <option value="Mức I">Mức I (-1đ)</option>
            <option value="Mức II">Mức II (-2đ)</option>
            <option value="Mức III">Mức III (-3đ)</option>
            <option value="Mức IV">Mức IV (-5đ)</option>
            <option value="Mức V">Mức V (-10đ)</option>
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã lỗi, nội dung..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm" />
          </div>
          {!readOnly && (
            <button onClick={() => setNewCode({ code: '', source_type: 'PHU_LUC_3', level_name: 'Mức I', points: -1, description: '', scope: 'Nghiệp vụ', applicable_groups: '1,2,3,4,5,6' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#9E1B32] text-white text-sm font-semibold cursor-pointer">
              <Plus className="w-4 h-4" /> Thêm mã
            </button>
          )}
        </div>
      </div>

      {newCode && !readOnly && (
        <form onSubmit={handleCreate} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-6 gap-2 text-sm">
          <input required placeholder="Mã lỗi (VD: L1.72)" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <select value={newCode.level_name} onChange={(e) => setNewCode({ ...newCode, level_name: e.target.value })} className="rounded-lg border px-2.5 py-1.5 bg-white">
            <option value="Mức I">Mức I</option><option value="Mức II">Mức II</option><option value="Mức III">Mức III</option><option value="Mức IV">Mức IV</option><option value="Mức V">Mức V</option>
          </select>
          <input type="number" step="0.5" value={newCode.points} onChange={(e) => setNewCode({ ...newCode, points: Number(e.target.value) })} className="rounded-lg border px-2.5 py-1.5 bg-white" />
          <input required placeholder="Nội dung lỗi" value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 bg-white" />
          <button type="submit" className="bg-[#9E1B32] text-white rounded-lg font-semibold cursor-pointer">Lưu mã</button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase sticky top-0">
              <tr>
                <th className="p-3 text-left">Mã lỗi</th>
                <th className="p-3 text-center">Cấp độ</th>
                <th className="p-3 text-center">Mức trừ</th>
                <th className="p-3 text-left">Nội dung chi tiết lỗi vi phạm</th>
                <th className="p-3 text-left">Phạm vi / Nhóm áp dụng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-[#9E1B32] whitespace-nowrap">{item.code}</td>
                  <td className="p-3 text-center text-xs font-semibold">{item.level_name}</td>
                  <td className="p-3 text-center font-bold text-rose-700 tabular-nums">{item.points}đ</td>
                  <td className="p-3 text-slate-800">{item.description}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {item.scope}
                    <div className="text-[11px] text-slate-400">Nhóm: {item.applicable_groups}</div>
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

