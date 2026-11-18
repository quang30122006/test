import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getToken, setToken } from './api';
import { gsap, useGSAP, runReducedMotionAware, installTactileInteractions } from './utils/gsapSetup';
import LoginView from './components/LoginView';
import Layout from './components/Layout';
import AdminMenuHub from './components/AdminMenuHub';
import { TableSkeleton } from './components/Skeleton';
import PeriodManagerView from './components/PeriodManagerView';
import ImportSalaryView from './components/ImportSalaryView';
import ImportTargetsView from './components/ImportTargetsView';
import AttendanceView from './components/AttendanceView';
import ExecutionTargetsView from './components/ExecutionTargetsView';
import ViolationFormView from './components/ViolationFormView';
import ViolationLogView from './components/ViolationLogView';
import KsvQueueView from './components/KsvQueueView';
import KpiMonthView from './components/KpiMonthView';
import Payroll3PView from './components/Payroll3PView';
import DashboardView from './components/DashboardView';

// Heavy views converted to React.lazy()
const FormulaStudioView = lazy(() => import('./components/FormulaStudioView'));
const PrintReportsView = lazy(() => import('./components/PrintReportsView'));
const DatasetManagerView = lazy(() => import('./components/DatasetManagerView'));
const EmployeesCatalogView = lazy(() =>
  import('./components/CatalogsViews').then((m) => ({ default: m.EmployeesCatalogView }))
);
const IndicatorsCatalogView = lazy(() =>
  import('./components/CatalogsViews').then((m) => ({ default: m.IndicatorsCatalogView }))
);
const InternalRulesCatalogView = lazy(() =>
  import('./components/CatalogsViews').then((m) => ({ default: m.InternalRulesCatalogView }))
);
const KpiErrorTreeCatalogView = lazy(() =>
  import('./components/CatalogsViews').then((m) => ({ default: m.KpiErrorTreeCatalogView }))
);
const StaffPortalView = lazy(() => import('./components/StaffPortalView'));
const AuditLogView = lazy(() => import('./components/AuditLogView'));
const DatabaseExplorerView = lazy(() => import('./components/DatabaseExplorerView'));
const SecurityView = lazy(() => import('./components/SecurityView'));
const AccumulationV3View = lazy(() => import('./components/AccumulationV3View'));
import { CheckCircle2, AlertTriangle, X, KeyRound } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [activeView, setActiveView] = useState('menu_hub');
  const [printEmpCode, setPrintEmpCode] = useState('');
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('2026-10');
  const [selectedYear, setSelectedYear] = useState(() => {
    const curYr = new Date().getFullYear();
    return curYr >= 2024 && curYr <= 2030 ? curYr : 2026;
  });
  const [currentPeriodCode, setCurrentPeriodCode] = useState('2026-10');
  const [ksvPendingCount, setKsvPendingCount] = useState(0);
  const [toast, setToast] = useState(null);

  const availableYears = useMemo(() => {
    const yrs = new Set(periods.map((p) => p.year_num || parseInt(p.period_code.split('-')[0], 10)));
    if (selectedPeriod) yrs.add(parseInt(selectedPeriod.split('-')[0], 10));
    if (yrs.size === 0) yrs.add(2026);
    return Array.from(yrs).sort((a, b) => b - a);
  }, [periods, selectedPeriod]);

  // Change password modal
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const toastRef = useRef(null);
  const pwModalRef = useRef(null);

  useEffect(() => installTactileInteractions(), []);

  useGSAP(() => {
    if (!pwModalOpen || !pwModalRef.current) return;
    return runReducedMotionAware(() => {
      gsap.fromTo(
        pwModalRef.current,
        { scale: 0.98, y: 6, autoAlpha: 0 },
        { scale: 1, y: 0, autoAlpha: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }
      );
    });
  }, { dependencies: [pwModalOpen] });

  useGSAP(() => {
    if (!toast || !toastRef.current) return;
    return runReducedMotionAware(() => {
      gsap.from(toastRef.current, {
        y: 8,
        autoAlpha: 0,
        duration: 0.35,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility',
      });
    });
  }, { dependencies: [toast?.id] });

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAdminMetadata = useCallback(async (preferredPeriod = null) => {
    try {
      const pRes = await apiFetch('/api/admin/periods');
      const list = pRes.periods || [];
      setPeriods(list);
      const cur = pRes.current_period_code || '2026-10';
      setCurrentPeriodCode(cur);
      const activeP = preferredPeriod || cur;
      setSelectedPeriod(activeP);
      const yr = parseInt(activeP.split('-')[0], 10);
      if (!isNaN(yr)) setSelectedYear(yr);

      const vRes = await apiFetch(`/api/operations/violations?period_code=${encodeURIComponent(activeP)}`);
      setKsvPendingCount(vRes?.ksv_summary?.pending_count || 0);
    } catch {
      // ignore initial metadata errors
    }
  }, []);

  const refreshKsvCount = useCallback(async (pcode = selectedPeriod) => {
    try {
      const vRes = await apiFetch(`/api/operations/violations?period_code=${encodeURIComponent(pcode)}`);
      setKsvPendingCount(vRes?.ksv_summary?.pending_count || 0);
    } catch {
      // ignore
    }
  }, [selectedPeriod]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setActiveView('menu_hub');
      notify('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', 'error');
    };
    window.addEventListener('agribank:unauthorized', onUnauthorized);
    return () => window.removeEventListener('agribank:unauthorized', onUnauthorized);
  }, [notify]);

  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const me = await apiFetch('/api/auth/me');
        setUser(me);
        if (me.role === 'ADMIN') {
          setActiveView('menu_hub');
          await loadAdminMetadata(me.current_period_code);
        } else {
          setActiveView('staff_payslip');
        }
      } catch {
        setToken('');
        setUser(null);
      } finally {
        setBooting(false);
      }
    };
    restoreSession();
  }, [loadAdminMetadata]);

  const handleLoginSuccess = async (data) => {
    try {
      const me = await apiFetch('/api/auth/me');
      setUser(me);
      if (me.role === 'ADMIN') {
        setActiveView('menu_hub');
        await loadAdminMetadata(me.current_period_code || data.current_period_code);
      } else {
        setActiveView('staff_payslip');
      }
    } catch {
      setUser(data);
      setActiveView(data.role === 'ADMIN' ? 'menu_hub' : 'staff_payslip');
      if (data.role === 'ADMIN') {
        await loadAdminMetadata(data.current_period_code);
      }
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setPeriods([]);
  };

  const handleChangePeriod = async (pcode) => {
    setSelectedPeriod(pcode);
    const yr = parseInt(pcode.split('-')[0], 10);
    if (!isNaN(yr) && yr !== selectedYear) {
      setSelectedYear(yr);
    }
    if (user?.role === 'ADMIN') {
      await refreshKsvCount(pcode);
    }
  };

  const handleChangeYear = (newYear) => {
    setSelectedYear(newYear);
    const periodsInYear = periods.filter((p) => (p.year_num || parseInt(p.period_code.split('-')[0], 10)) === newYear);
    if (periodsInYear.length > 0) {
      const openP = periodsInYear.find((p) => p.status === 'ĐANG MỞ') || periodsInYear[0];
      handleChangePeriod(openP.period_code);
    } else {
      handleChangePeriod(`${newYear}-01`);
    }
  };

  const handleNavigate = (key, opts = {}) => {
    if (key === 'bang_luong_3p') {
      setActiveView('payroll_3p');
      return;
    }
    if (key === 'print_reports') {
      if (opts.empCode) setPrintEmpCode(opts.empCode);
      if (opts.tab === 'v2') setActiveView('print_v2');
      else if (opts.tab === 'v3') setActiveView('print_v3');
      else setActiveView('payslip_admin');
      return;
    }
    if (opts.empCode) setPrintEmpCode(opts.empCode);
    setActiveView(key);
  };

  const handleOpenPeriodAction = async (action) => {
    try {
      if (action === 'close') {
        if (!window.confirm('Xác nhận Chốt sổ & Khóa kỳ ĐANG MỞ hiện tại và ghi snapshot vào TichLuy_V3?')) return;
        const res = await apiFetch('/api/admin/periods/close-current', { method: 'POST' });
        notify(res.message || 'Đã chốt sổ & khóa kỳ hiện tại');
        await loadAdminMetadata(selectedPeriod);
      } else if (action === 'open') {
        if (!window.confirm('Mở kỳ tính lương kế tiếp và chuyển dữ liệu khung sang kỳ mới?')) return;
        const res = await apiFetch('/api/admin/periods/open-next?carry_forward_data=true', {
          method: 'POST',
        });
        notify(res.message || 'Đã mở kỳ tính lương mới');
        await loadAdminMetadata(res.current_period_code);
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    if (!pwForm.old_password || !pwForm.new_password) {
      notify('Vui lòng nhập mật khẩu cũ và mật khẩu mới', 'error');
      return;
    }
    if (pwForm.new_password.length < 4) {
      notify('Mật khẩu mới tối thiểu 4 ký tự', 'error');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      notify('Mật khẩu xác nhận không khớp', 'error');
      return;
    }
    setPwSaving(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          old_password: pwForm.old_password,
          new_password: pwForm.new_password,
        }),
      });
      notify(res.message || 'Đổi mật khẩu thành công');
      setPwModalOpen(false);
      setPwForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setPwSaving(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm font-semibold">
        Đang khởi tạo Hệ thống Tiền lương & KPI 3P Agribank...
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const renderAdminContent = () => {
    switch (activeView) {
      case 'menu_hub':
        return (
          <AdminMenuHub
            selectedPeriod={selectedPeriod}
            periods={periods}
            onNavigate={handleNavigate}
            onSelectPeriod={handleChangePeriod}
            onOpenPeriodAction={handleOpenPeriodAction}
            ksvPendingCount={ksvPendingCount}
          />
        );
      // Khối 1
      case 'formula_studio':
        return <FormulaStudioView selectedPeriod={selectedPeriod} onConfigSaved={() => loadAdminMetadata(selectedPeriod)} />;
      case 'periods':
        return (
          <PeriodManagerView
            periods={periods}
            currentPeriodCode={currentPeriodCode}
            onRefreshPeriods={() => loadAdminMetadata(selectedPeriod)}
            onSelectPeriod={handleChangePeriod}
            notify={notify}
          />
        );
      case 'employees':
        return <EmployeesCatalogView onNavigate={handleNavigate} />;
      case 'indicators':
        return <IndicatorsCatalogView />;
      case 'internal_rules':
        return <InternalRulesCatalogView />;
      case 'kpi_tree':
        return <KpiErrorTreeCatalogView />;
      case 'security':
        return (
          <SecurityView
            selectedPeriod={selectedPeriod}
            periods={periods}
            onReloadPeriods={() => loadAdminMetadata(selectedPeriod)}
            notify={notify}
          />
        );
      // Khối 2
      case 'dataset_manager':
        return (
          <DatasetManagerView
            selectedYear={selectedYear}
            onNavigate={handleNavigate}
            onSelectPeriod={handleChangePeriod}
            onReloadPeriods={() => loadAdminMetadata(selectedPeriod)}
            notify={notify}
          />
        );
      case 'import_salary':
        return <ImportSalaryView selectedPeriod={selectedPeriod} periods={periods} selectedYear={selectedYear} onNavigate={handleNavigate} notify={notify} />;
      case 'import_targets':
        return <ImportTargetsView selectedPeriod={selectedPeriod} periods={periods} selectedYear={selectedYear} notify={notify} />;
      case 'attendance':
        return <AttendanceView selectedPeriod={selectedPeriod} periods={periods} notify={notify} />;
      case 'execution':
        return <ExecutionTargetsView selectedPeriod={selectedPeriod} periods={periods} notify={notify} />;
      case 'violation_form':
        return (
          <ViolationFormView
            selectedPeriod={selectedPeriod}
            periods={periods}
            onNavigate={handleNavigate}
            notify={notify}
            onReloadKsv={() => refreshKsvCount(selectedPeriod)}
          />
        );
      case 'violation_log':
        return (
          <ViolationLogView
            selectedPeriod={selectedPeriod}
            periods={periods}
            onNavigate={handleNavigate}
            notify={notify}
            onReloadKsv={() => refreshKsvCount(selectedPeriod)}
          />
        );
      case 'ksv_queue':
        return (
          <KsvQueueView
            selectedPeriod={selectedPeriod}
            periods={periods}
            notify={notify}
            onReloadKsv={() => refreshKsvCount(selectedPeriod)}
          />
        );
      // Khối 3
      case 'kpi_month':
        return <KpiMonthView selectedPeriod={selectedPeriod} periods={periods} onNavigate={handleNavigate} notify={notify} />;
      case 'payroll_3p':
        return <Payroll3PView selectedPeriod={selectedPeriod} onNavigate={handleNavigate} notify={notify} />;
      case 'tich_luy_v3':
        return <AccumulationV3View selectedYear={selectedYear} onNavigate={handleNavigate} notify={notify} />;
      case 'print_v2':
        return <PrintReportsView selectedPeriod={selectedPeriod} selectedYear={selectedYear} initialTab="v2" notify={notify} onTabChange={(tabKey) => handleNavigate('print_reports', { tab: tabKey })} />;
      // Khối 4
      case 'payslip_admin':
        return <PrintReportsView selectedPeriod={selectedPeriod} selectedYear={selectedYear} initialTab="payslip" initialEmpCode={printEmpCode} notify={notify} onTabChange={(tabKey) => handleNavigate('print_reports', { tab: tabKey })} />;
      case 'dashboard':
        return <DashboardView selectedPeriod={selectedPeriod} onNavigate={handleNavigate} notify={notify} />;
      case 'audit_log':
        return <AuditLogView notify={notify} />;
      case 'print_v3':
        return <PrintReportsView selectedPeriod={selectedPeriod} selectedYear={selectedYear} initialTab="v3" notify={notify} onTabChange={(tabKey) => handleNavigate('print_reports', { tab: tabKey })} />;
      case 'db_explorer':
        return <DatabaseExplorerView notify={notify} />;
      default:
        return (
          <AdminMenuHub
            selectedPeriod={selectedPeriod}
            periods={periods}
            onNavigate={handleNavigate}
            onOpenPeriodAction={handleOpenPeriodAction}
            ksvPendingCount={ksvPendingCount}
          />
        );
    }
  };

  const renderStaffContent = () => {
    const tabMap = {
      staff_payslip: 'my_payslip',
      staff_v3: 'my_accumulation',
      staff_attendance: 'my_attendance_violations',
      staff_catalogs: 'my_rules',
    };
    return <StaffPortalView user={user} activeTab={tabMap[activeView] || 'my_payslip'} notify={notify} />;
  };

  return (
    <>
      <Layout
        user={user}
        activeView={activeView}
        onNavigate={handleNavigate}
        periods={user.role === 'ADMIN' ? periods : []}
        selectedPeriod={selectedPeriod}
        onChangePeriod={handleChangePeriod}
        selectedYear={selectedYear}
        onChangeYear={handleChangeYear}
        availableYears={availableYears}
        ksvPendingCount={ksvPendingCount}
        onOpenChangePassword={() => setPwModalOpen(true)}
        onLogout={handleLogout}
      >
        <Suspense fallback={<TableSkeleton />}>
          {user.role === 'ADMIN' ? renderAdminContent() : renderStaffContent()}
        </Suspense>
      </Layout>

      {/* Toast Notification */}
      {toast && (
        <div
          ref={toastRef}
          className={`no-print fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-sm font-semibold ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal Đổi mật khẩu */}
      {pwModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div ref={pwModalRef} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#9E1B32] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="font-bold text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Đổi mật khẩu ({user.full_name})
              </div>
              <button onClick={() => setPwModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPassword} className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={pwForm.old_password}
                  onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#9E1B32]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={pwForm.new_password}
                  onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#9E1B32]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#9E1B32]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="px-4 py-2 rounded-xl bg-[#9E1B32] hover:bg-[#801427] text-white text-xs font-bold cursor-pointer"
                >
                  {pwSaving ? 'Đang lưu...' : 'Xác nhận đổi MK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

