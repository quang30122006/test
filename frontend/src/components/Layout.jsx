import React, { useRef, useState } from 'react';
import {
  LayoutGrid, Settings2, CalendarDays, Users, Target, ShieldAlert, BookOpen, Lock, Database,
  Upload, FileSpreadsheet, ClipboardCheck, TrendingUp, AlertTriangle, FileText, ShieldCheck,
  Award, Wallet, Layers, Printer, BarChart3, History, UserCheck, LogOut, KeyRound, ChevronRight, Menu, X,
  Search, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { periodStatusBadge } from '../utils/format';
import { gsap, useGSAP, runReducedMotionAware, animateSelectionPop, animateTabContentEnter } from '../utils/gsapSetup';
import SlidingTabs from './SlidingTabs';

export const ADMIN_BLOCKS = [
  {
    id: 'block1',
    title: 'KHỐI 1: DANH MỤC, THAM SỐ & CÔNG THỨC',
    short: 'Khối 1 · Quản trị & Công thức',
    color: 'text-rose-700',
    items: [
      { key: 'formula_studio', label: '1. Tham số & Studio Công thức', icon: Settings2, desc: 'Trọng số, ngưỡng, công thức V1/V2/V3 & giả lập' },
      { key: 'periods', label: '2. Quản lý 12 kỳ tính lương', icon: CalendarDays, desc: 'Mở kỳ, Khóa/Mở khóa sửa & Xóa dữ liệu tháng' },
      { key: 'employees', label: '3. Danh mục cán bộ & Định mức', icon: Users, desc: 'Hồ sơ 1.DM_CanBo, HSL V1, V2 gốc, Phân nhóm' },
      { key: 'indicators', label: '4. Cây chỉ tiêu giao khoán (GK)', icon: Target, desc: 'CT01–CT08, Tỷ trọng & Mức giao Trực/Gián tiếp' },
      { key: 'internal_rules', label: '5. Danh mục nội quy vi phạm', icon: ShieldAlert, desc: 'Quy định P1: I.01–I.10, III.09–III.11, NQ01–NQ05' },
      { key: 'kpi_tree', label: '6. Bộ mã KPI nghiệp vụ (P3)', icon: BookOpen, desc: '290 mã Phụ lục 3 & 828 mã gợi ý mở rộng' },
      { key: 'security', label: '7. Bảo mật & Dọn dữ liệu kỳ', icon: Lock, desc: 'Đổi mật khẩu Quản trị & Xóa dữ liệu theo tháng' },
    ],
  },
  {
    id: 'block2',
    title: 'KHỐI 2: TIẾP NHẬN, KIỂM SOÁT & PHÊ DUYỆT',
    short: 'Khối 2 · Tiếp nhận & Kiểm soát',
    color: 'text-amber-700',
    items: [
      { key: 'dataset_manager', label: '0. Quản lý Dataset 12 Tháng', icon: Database, desc: 'Nạp trọn bộ 12 tháng, Soát lỗi & Xuất Dataset .xlsx' },
      { key: 'import_salary', label: '1. Tiếp nhận bảng lương V1 + V2', icon: Upload, desc: 'Import file Excel Lương hoặc đồng bộ từ Danh mục' },
      { key: 'import_targets', label: '2. Tiếp nhận chỉ tiêu kinh doanh', icon: FileSpreadsheet, desc: 'Import Excel Chỉ tiêu hoặc khởi tạo từ Cây GK' },
      { key: 'attendance', label: '3. Bảng chấm công (Ki / Kchuẩn)', icon: ClipboardCheck, desc: 'Cập nhật ngày công thực tế & tỷ lệ công' },
      { key: 'execution', label: '4. Kết quả thực hiện GK (P2)', icon: TrendingUp, desc: 'Chi tiết Ai, Ti, tỷ lệ Ci, điểm Si & Si × wi' },
      { key: 'violation_form', label: '5. Ghi nhận vi phạm (Form)', icon: AlertTriangle, desc: 'Lập biên bản lỗi P1/P3 & tính liên đới KSV/PD' },
      { key: 'violation_log', label: '6. Nhật ký lỗi vi phạm', icon: FileText, desc: 'Theo dõi toàn bộ biên bản BBxxx trong kỳ' },
      { key: 'ksv_queue', label: '7. Hàng chờ KSV phê duyệt', icon: ShieldCheck, desc: 'Thẩm duyệt chấp nhận/từ chối điểm liên đới KSV', badgeKey: 'ksvPending' },
    ],
  },
  {
    id: 'block3',
    title: 'KHỐI 3: TÍNH TOÁN KPI & TIỀN LƯƠNG 3P',
    short: 'Khối 3 · Tính toán KPI & 3P',
    color: 'text-emerald-700',
    items: [
      { key: 'kpi_month', label: '1. Bảng đánh giá KPI 3 trụ cột', icon: Award, desc: 'Điểm CM 75%, KPI 25%, Tcv, Ưu tiên & Xếp loại' },
      { key: 'payroll_3p', label: '2. Bảng thanh toán lương 3P', icon: Wallet, desc: 'V1 thực lĩnh, V2 sau ĐC, NSi phân bổ & Chênh lệch' },
      { key: 'tich_luy_v3', label: '3. Tích lũy V2 & Quyết toán V3', icon: Layers, desc: 'Lũy kế 12 tháng, Quyết toán 4 Quý/Năm & Quỹ V3' },
      { key: 'print_v2', label: '4. In Bảng lương kinh doanh V2', icon: Printer, desc: 'Mẫu 02/TL-V2 chuẩn in A4 & đọc số thành chữ' },
    ],
  },
  {
    id: 'block4',
    title: 'KHỐI 4: BÁO CÁO & ĐIỀU HÀNH LÃNH ĐẠO',
    short: 'Khối 4 · Báo cáo & Lãnh đạo',
    color: 'text-sky-700',
    items: [
      { key: 'payslip_admin', label: '1. Tìm kiếm & In hồ sơ CB', icon: UserCheck, desc: 'Tìm bất kỳ cán bộ để xem thông tin, phiếu lương & in A4' },
      { key: 'dashboard', label: '2. Dashboard điều hành trực quan', icon: BarChart3, desc: 'Thống kê nhân sự, cơ cấu quỹ V1/V2/QNS & xếp loại' },
      { key: 'audit_log', label: '3. Nhật ký kiểm toán hệ thống', icon: History, desc: 'Truy vết toàn bộ lịch sử thao tác quản trị' },
      { key: 'print_v3', label: '4. In Bảng thù lao năng suất V3', icon: Printer, desc: 'Mẫu 03/TL-V3 quyết toán thù lao năm & đọc chữ' },
      { key: 'db_explorer', label: '5. Bảng dữ liệu CSDL Web', icon: Database, desc: 'Xem trực tiếp 13 bảng SQLite, tìm kiếm & in bảng dữ liệu' },
    ],
  },
];

export const STAFF_TABS = [
  { key: 'staff_payslip', label: 'Phiếu lương & KPI của tôi', icon: Wallet },
  { key: 'staff_v3', label: 'Tích lũy 12 tháng & V3', icon: Layers },
  { key: 'staff_attendance', label: 'Chấm công, Lỗi & KSV', icon: ShieldCheck },
  { key: 'staff_catalogs', label: 'Tra cứu Quy chế & Mã KPI', icon: BookOpen },
];

export default function Layout({
  user,
  activeView,
  onNavigate,
  periods,
  selectedPeriod,
  onChangePeriod,
  ksvPendingCount = 0,
  onOpenChangePassword,
  onLogout,
  children,
}) {
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [menuQuery, setMenuQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null); // { blk, left, top, pinned }
  const hoverTimerRef = useRef(null);
  const touchCardRef = useRef(null);
  const mainRef = useRef(null);
  const periodBoxRef = useRef(null);
  const isFirstPeriodRef = useRef(true);
  const staffNavRef = useRef(null);
  const staffPillRef = useRef(null);
  const staffBtnRefs = useRef({});
  const isFirstStaffTabRef = useRef(true);

  const curPeriodObj = periods.find((p) => p.period_code === selectedPeriod);

  const cancelClose3DTouch = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const compute3DTouchPos = (blk, targetEl) => {
    const rect = targetEl.getBoundingClientRect();
    const estHeight = 64 + blk.items.length * 58;
    const maxTop = Math.max(12, window.innerHeight - Math.min(estHeight, window.innerHeight - 24) - 12);
    const clampedTop = gsap.utils.clamp(12, maxTop, rect.top - 10);
    const clampedLeft = Math.min(Math.round(rect.right + 10), Math.max(12, window.innerWidth - 350));
    return { top: Math.round(clampedTop), left: clampedLeft };
  };

  const open3DTouch = (blk, e, pinned = false) => {
    cancelClose3DTouch();
    const pos = compute3DTouchPos(blk, e.currentTarget);
    setHoverPreview({ blk, ...pos, pinned });
  };

  const handleClickBlock = (blk, e) => {
    cancelClose3DTouch();
    if (hoverPreview?.blk?.id === blk.id && hoverPreview?.pinned) {
      setHoverPreview(null);
      return;
    }
    open3DTouch(blk, e, true);
  };

  const scheduleClose3DTouch = () => {
    cancelClose3DTouch();
    hoverTimerRef.current = setTimeout(() => {
      setHoverPreview((prev) => (prev?.pinned ? prev : null));
    }, 160);
  };

  useGSAP(() => {
    const el = mainRef.current?.querySelector('.view-stage');
    if (!el) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(el, { y: 12, scale: 0.993, duration: 0.3 });
    });
  }, { scope: mainRef, dependencies: [activeView] });

  useGSAP(() => {
    if (isFirstPeriodRef.current) {
      isFirstPeriodRef.current = false;
      return;
    }
    if (periodBoxRef.current) animateSelectionPop(periodBoxRef.current, 0.965);
  }, { dependencies: [selectedPeriod] });

  useGSAP(() => {
    if (user?.role === 'ADMIN') return;
    const pill = staffPillRef.current;
    const btn = staffBtnRefs.current[activeView];
    if (!pill || !btn) return;
    const shouldAnimate = !isFirstStaffTabRef.current;
    isFirstStaffTabRef.current = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const target = { y: btn.offsetTop, height: btn.offsetHeight, autoAlpha: 1 };
    if (!shouldAnimate || reduced) {
      gsap.set(pill, target);
    } else {
      gsap.to(pill, { ...target, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
      animateSelectionPop(btn, 0.965);
    }
  }, { scope: staffNavRef, dependencies: [activeView, sidebarCollapsed, user?.role] });

  useGSAP(() => {
    if (!hoverPreview || !touchCardRef.current) return;
    return runReducedMotionAware(() => {
      const tl = gsap.timeline({ defaults: { clearProps: 'transform,opacity,visibility' } });
      tl.fromTo(
        touchCardRef.current,
        { scale: 0.9, x: -12, rotateY: -8, transformPerspective: 900, transformOrigin: 'left center', autoAlpha: 0 },
        { scale: 1, x: 0, rotateY: 0, autoAlpha: 1, duration: 0.28, ease: 'back.out(1.6)' }
      ).fromTo(
        '.touch-item',
        { x: -6, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.2, stagger: 0.022, ease: 'power2.out' },
        '-=0.16'
      );
    });
  }, { scope: touchCardRef, dependencies: [hoverPreview?.blk?.id], revertOnUpdate: true });

  const qMenu = menuQuery.trim().toLowerCase();

  const blockAccent = {
    block1: { header: 'from-[#8B152B] to-rose-700', ring: 'border-rose-200 ring-rose-100', pill: 'bg-rose-50 text-[#9E1B32]', badge: 'bg-rose-100 text-[#9E1B32]' },
    block2: { header: 'from-amber-600 to-amber-500', ring: 'border-amber-200 ring-amber-100', pill: 'bg-amber-50 text-amber-800', badge: 'bg-amber-100 text-amber-800' },
    block3: { header: 'from-emerald-700 to-emerald-600', ring: 'border-emerald-200 ring-emerald-100', pill: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-800' },
    block4: { header: 'from-sky-700 to-sky-600', ring: 'border-sky-200 ring-sky-100', pill: 'bg-sky-50 text-sky-800', badge: 'bg-sky-100 text-sky-800' },
  };

  return (
    <div className="min-h-screen flex bg-[#f4f6f9] text-slate-900">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="no-print fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Sidebar Desktop + Mobile Drawer */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 ${
          sidebarCollapsed ? 'lg:w-[74px]' : 'lg:w-[272px]'
        } w-72 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 lg:inset-auto lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="shrink-0 px-3.5 py-3.5 bg-gradient-to-r from-[#8B152B] to-[#9E1B32] text-white flex items-center justify-between gap-2">
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold truncate">AGRIBANK QUẢNG BÌNH</div>
              <div className="text-sm font-extrabold leading-snug truncate">AGRIBANK 3P</div>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0 mx-auto lg:mx-0">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full font-bold ${user.role === 'ADMIN' ? 'bg-rose-100 text-[#9E1B32]' : 'bg-sky-100 text-sky-800'}`}>
              {user.role === 'ADMIN' ? 'QUẢN TRỊ / GIÁM ĐỐC' : 'CÁN BỘ NHÂN VIÊN'}
            </span>
            {user.emp_code && <span className="text-slate-500 font-mono">{user.emp_code}</span>}
          </div>
        )}

        {/* Tìm nhanh menu & lọc nhanh 4 khối */}
        {user.role === 'ADMIN' && !sidebarCollapsed && (
          <div className="p-2.5 border-b border-slate-100 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="Tìm nhanh mục..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs outline-none focus:border-[#9E1B32]"
              />
            </div>
            <SlidingTabs
              items={[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'block1', label: 'K1' },
                { id: 'block2', label: 'K2' },
                { id: 'block3', label: 'K3' },
                { id: 'block4', label: 'K4' },
              ]}
              value={blockFilter}
              onChange={setBlockFilter}
              className="grid grid-cols-5 gap-1 p-0.5 bg-slate-100 rounded-lg text-[10px]"
              buttonClassName="py-1 px-1 rounded-md text-[10px] font-bold"
              pillClassName="bg-[#9E1B32] shadow-xs rounded-md"
              inactiveTextClass="text-slate-600 hover:text-slate-900"
            />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {user.role === 'ADMIN' ? (
            <>
              <button
                onClick={() => { onNavigate('menu_hub'); setHoverPreview(null); setMobileMenuOpen(false); }}
                title="Tổng quan Điều hành (Màn hình chính)"
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  activeView === 'menu_hub'
                    ? 'bg-[#9E1B32] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>Tổng quan Điều hành</span>}
              </button>

              {qMenu ? (
                /* Kết quả tìm nhanh trực tiếp khi gõ từ khóa */
                <div className="space-y-1 pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kết quả tìm kiếm ({ADMIN_BLOCKS.filter((blk) => blockFilter === 'ALL' || blk.id === blockFilter).flatMap((blk) => blk.items).filter((it) => it.label.toLowerCase().includes(qMenu) || it.desc.toLowerCase().includes(qMenu)).length})
                  </div>
                  {ADMIN_BLOCKS.filter((blk) => blockFilter === 'ALL' || blk.id === blockFilter).flatMap((blk) =>
                    blk.items
                      .filter((it) => it.label.toLowerCase().includes(qMenu) || it.desc.toLowerCase().includes(qMenu))
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.key;
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              onNavigate(item.key);
                              setHoverPreview(null);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition text-left cursor-pointer ${
                              isActive
                                ? 'bg-rose-50 text-[#9E1B32] font-semibold border border-rose-200'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0 text-[#9E1B32]" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })
                  )}
                </div>
              ) : (
                ADMIN_BLOCKS.filter((blk) => blockFilter === 'ALL' || blk.id === blockFilter).map((blk, bIdx) => {
                  const isHovered = hoverPreview?.blk?.id === blk.id;
                  const containsActive = blk.items.some((it) => it.key === activeView);
                  const blkPendingBadge = blk.id === 'block2' ? ksvPendingCount : 0;
                  const shortIcons = [Settings2, Database, Wallet, BarChart3];
                  const BlkIcon = shortIcons[bIdx] || LayoutGrid;
                  return (
                    <div
                      key={blk.id}
                      className="pt-0.5"
                      onMouseEnter={(e) => open3DTouch(blk, e, false)}
                      onMouseLeave={scheduleClose3DTouch}
                    >
                      {sidebarCollapsed ? (
                        <button
                          onClick={(e) => handleClickBlock(blk, e)}
                          title={blk.short}
                          className={`w-full flex items-center justify-center p-2.5 rounded-xl transition cursor-pointer ${
                            isHovered || containsActive
                              ? 'bg-rose-50 text-[#9E1B32] shadow-sm scale-[1.03] border border-rose-200'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <BlkIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleClickBlock(blk, e)}
                          className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                            isHovered
                              ? 'bg-white shadow-md scale-[1.02] border border-slate-200 text-slate-900'
                              : containsActive
                              ? 'bg-rose-50/80 text-slate-900 border border-rose-200'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0 truncate">
                            <span className={`${blk.color} truncate`}>{blk.short}</span>
                            {containsActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#9E1B32] shrink-0" title="Khối đang mở" />
                            )}
                            {blkPendingBadge > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-bold">
                                {blkPendingBadge}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-semibold text-slate-400">{blk.items.length}</span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isHovered ? 'translate-x-0.5 text-[#9E1B32]' : ''}`} />
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <div ref={staffNavRef} className="relative space-y-1">
              <span
                ref={staffPillRef}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 top-0 rounded-xl bg-[#9E1B32] shadow-sm opacity-0"
              />
              {!sidebarCollapsed && (
                <div className="relative z-10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Cổng thông tin cá nhân
                </div>
              )}
              {STAFF_TABS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    ref={(el) => { if (el) staffBtnRefs.current[item.key] = el; }}
                    title={item.label}
                    onClick={() => { onNavigate(item.key); setMobileMenuOpen(false); }}
                    className={`relative z-10 w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2.5 rounded-xl text-sm font-medium transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="shrink-0 p-2.5 border-t border-slate-200 bg-slate-50 space-y-1.5">
          {!sidebarCollapsed && (
            <div className="px-2 py-0.5 text-xs">
              <div className="font-semibold text-slate-800 truncate">{user.full_name}</div>
              {user.title && <div className="text-slate-500 truncate">{user.title} · {user.department}</div>}
            </div>
          )}
          <div className={`grid ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
            <button
              onClick={onOpenChangePassword}
              title="Đổi mật khẩu"
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Đổi MK'}
            </button>
            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Đăng xuất'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-xs text-slate-500 font-medium">
                {user.org_name || 'NGÂN HÀNG NÔNG NGHIỆP & PTNT VIỆT NAM - CHI NHÁNH QUẢNG BÌNH'}
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-900">
                {user.role === 'ADMIN'
                  ? (activeView === 'menu_hub'
                      ? 'Trung tâm Điều hành & Thống kê 3P (Màn hình chính)'
                      : ADMIN_BLOCKS.flatMap((b) => b.items).find((i) => i.key === activeView)?.label || 'Quản trị Hệ thống')
                  : STAFF_TABS.find((t) => t.key === activeView)?.label || 'Cổng Cán bộ'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {periods.length > 0 && (
              <div ref={periodBoxRef} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <CalendarDays className="w-4 h-4 text-[#9E1B32]" />
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Kỳ làm việc:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => onChangePeriod(e.target.value)}
                  className="text-xs sm:text-sm font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {periods.map((p) => (
                    <option key={p.period_code} value={p.period_code}>
                      {p.period_name} ({p.status})
                    </option>
                  ))}
                </select>
                {curPeriodObj && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${periodStatusBadge(curPeriodObj.status)}`}>
                    {curPeriodObj.status}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 sm:p-5 max-w-[1600px] w-full mx-auto">
          <div key={activeView} className="view-stage">
            {children}
          </div>
        </main>
      </div>

      {/* 3D Touch Hover Popover cho 4 Khối Sidebar */}
      {hoverPreview && user.role === 'ADMIN' && (
        <>
          <div
            onClick={() => setHoverPreview(null)}
            className={`no-print fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] ${
              hoverPreview.pinned ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          />
          <div
            ref={touchCardRef}
            onMouseEnter={cancelClose3DTouch}
            onMouseLeave={scheduleClose3DTouch}
            style={{ top: `${hoverPreview.top}px`, left: `${hoverPreview.left}px` }}
            className={`no-print fixed z-50 w-[335px] max-w-[90vw] rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border ring-4 ${
              blockAccent[hoverPreview.blk.id].ring
            } overflow-visible before:content-[''] before:absolute before:-left-4 before:inset-y-0 before:w-5`}
          >
            <div className="rounded-2xl overflow-hidden">
              <div className={`bg-gradient-to-r ${blockAccent[hoverPreview.blk.id].header} text-white px-4 py-2.5 flex items-center justify-between`}>
                <span className="font-extrabold text-xs tracking-wide">{hoverPreview.blk.title}</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                  {hoverPreview.blk.items.length} mục
                </span>
              </div>
              <div className="p-2 space-y-1 max-h-[calc(100vh-88px)] overflow-y-auto">
                {hoverPreview.blk.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.key;
                  const badgeVal = item.badgeKey === 'ksvPending' ? ksvPendingCount : 0;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onNavigate(item.key);
                        setHoverPreview(null);
                        setMobileMenuOpen(false);
                      }}
                      className={`touch-item w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition cursor-pointer group ${
                        isActive
                          ? 'bg-rose-50 border border-rose-200 text-[#9E1B32]'
                          : 'hover:bg-slate-50 border border-transparent hover:border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${blockAccent[hoverPreview.blk.id].pill}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold flex items-center gap-1.5 truncate group-hover:text-[#9E1B32]">
                            <span className="truncate">{item.label}</span>
                            {badgeVal > 0 && (
                              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-bold shrink-0">
                                {badgeVal}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#9E1B32] group-hover:translate-x-0.5 transition shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

