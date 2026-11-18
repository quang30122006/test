import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutGrid, Settings2, CalendarDays, Users, Target, ShieldAlert, BookOpen, Lock, Database,
  Upload, FileSpreadsheet, ClipboardCheck, TrendingUp, AlertTriangle, FileText, ShieldCheck,
  Award, Wallet, Layers, Printer, BarChart3, History, UserCheck, LogOut, KeyRound, ChevronRight, ChevronDown, Menu, X,
  Search, PanelLeftClose, PanelLeftOpen, ArrowLeft
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
  selectedYear,
  onChangeYear,
  availableYears = [],
  ksvPendingCount = 0,
  onOpenChangePassword,
  onLogout,
  children,
}) {
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [menuQuery, setMenuQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compactPopover, setCompactPopover] = useState(null); // { blk, top } khi sidebarCollapsed === true
  const [expandedBlocks, setExpandedBlocks] = useState(() => {
    const cur = ADMIN_BLOCKS.find((b) => b.items.some((it) => it.key === activeView));
    return cur ? [cur.id] : [];
  });
  const compactPopRef = useRef(null);
  const mainRef = useRef(null);
  const periodBoxRef = useRef(null);
  const isFirstPeriodRef = useRef(true);
  const staffNavRef = useRef(null);
  const staffPillRef = useRef(null);
  const staffBtnRefs = useRef({});
  const isFirstStaffTabRef = useRef(true);

  const curPeriodObj = periods.find((p) => p.period_code === selectedPeriod);

  // Tự động mở rộng khối chứa màn hình đang hoạt động
  useEffect(() => {
    const cur = ADMIN_BLOCKS.find((b) => b.items.some((it) => it.key === activeView));
    if (cur) {
      setExpandedBlocks((prev) => (prev.includes(cur.id) ? prev : [...prev, cur.id]));
    }
  }, [activeView]);

  const toggleBlock = (blkId) => {
    setExpandedBlocks((prev) => (prev.includes(blkId) ? prev.filter((id) => id !== blkId) : [...prev, blkId]));
  };

  const handleCollapsedBlockClick = (blk, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const estHeight = 48 + blk.items.length * 44;
    const maxTop = Math.max(12, window.innerHeight - estHeight - 12);
    const top = Math.min(Math.max(12, Math.round(rect.top)), maxTop);
    setCompactPopover((prev) => (prev?.blk?.id === blk.id ? null : { blk, top }));
  };

  useGSAP(() => {
    const el = mainRef.current?.querySelector('.view-stage');
    if (!el) return;
    return runReducedMotionAware(() => {
      animateTabContentEnter(el, { y: 4, scale: 1, duration: 0.38 });
    });
  }, { scope: mainRef, dependencies: [activeView] });

  useGSAP(() => {
    if (isFirstPeriodRef.current) {
      isFirstPeriodRef.current = false;
      return;
    }
    if (periodBoxRef.current) animateSelectionPop(periodBoxRef.current, 0.985);
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
      gsap.to(pill, { ...target, duration: 0.38, ease: 'power2.out', overwrite: 'auto' });
    }
  }, { scope: staffNavRef, dependencies: [activeView, sidebarCollapsed, user?.role] });

  useGSAP(() => {
    if (!compactPopover || !compactPopRef.current) return;
    return runReducedMotionAware(() => {
      gsap.fromTo(
        compactPopRef.current,
        { scale: 0.98, x: -6, autoAlpha: 0 },
        { scale: 1, x: 0, autoAlpha: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }
      );
    });
  }, { scope: compactPopRef, dependencies: [compactPopover?.blk?.id] });

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
              onChange={(nextFilter) => {
                setBlockFilter(nextFilter);
                if (nextFilter !== 'ALL') {
                  setExpandedBlocks([nextFilter]);
                }
              }}
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
                onClick={() => {
                  onNavigate('menu_hub');
                  setExpandedBlocks([]);
                  setMobileMenuOpen(false);
                }}
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
                              setCompactPopover(null);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                              isActive
                                ? 'bg-[#9E1B32] text-white font-bold shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#9E1B32]'}`} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })
                  )}
                </div>
              ) : (
                ADMIN_BLOCKS.filter((blk) => blockFilter === 'ALL' || blk.id === blockFilter).map((blk, bIdx) => {
                  const isExpanded = expandedBlocks.includes(blk.id);
                  const containsActive = blk.items.some((it) => it.key === activeView);
                  const blkPendingBadge = blk.id === 'block2' ? ksvPendingCount : 0;
                  const shortIcons = [Settings2, Database, Wallet, BarChart3];
                  const BlkIcon = shortIcons[bIdx] || LayoutGrid;

                  if (sidebarCollapsed) {
                    return (
                      <div key={blk.id} className="pt-0.5">
                        <button
                          onClick={(e) => handleCollapsedBlockClick(blk, e)}
                          title={blk.short}
                          className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-colors duration-200 cursor-pointer ${
                            containsActive || compactPopover?.blk?.id === blk.id
                              ? 'bg-rose-50 text-[#9E1B32] shadow-xs border border-rose-200'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <BlkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={blk.id} className="pt-0.5">
                      <button
                        onClick={() => toggleBlock(blk.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                          containsActive
                            ? 'bg-rose-50/90 text-slate-900 border border-rose-200/90'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0 truncate">
                          <BlkIcon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className={`${blk.color} truncate`}>{blk.short}</span>
                          {containsActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9E1B32] shrink-0" title="Khối đang chọn" />
                          )}
                          {blkPendingBadge > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-bold">
                              {blkPendingBadge}
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                            isExpanded ? 'rotate-180 text-[#9E1B32]' : ''
                          }`}
                        />
                      </button>

                      {/* Accordion cây thư mục trong sidebar */}
                      {isExpanded && (
                        <div className="ml-3 pl-2.5 my-1 border-l-2 border-slate-200/80 space-y-0.5">
                          {blk.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeView === item.key;
                            const badgeVal = item.badgeKey === 'ksvPending' ? ksvPendingCount : 0;
                            return (
                              <button
                                key={item.key}
                                onClick={() => {
                                  onNavigate(item.key);
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                                  isActive
                                    ? 'bg-[#9E1B32] text-white font-bold shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 truncate">
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {badgeVal > 0 && (
                                  <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full shrink-0 ${
                                    isActive ? 'bg-white text-[#9E1B32]' : 'bg-amber-500 text-white'
                                  }`}>
                                    {badgeVal}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
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
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Nút Quay lại Tổng quan khi đang ở view con */}
            {user.role === 'ADMIN' && activeView !== 'menu_hub' && (
              <button
                onClick={() => {
                  onNavigate('menu_hub');
                  setExpandedBlocks([]);
                }}
                title="Quay lại Trung tâm Điều hành"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-[#9E1B32] text-xs font-bold text-slate-700 transition cursor-pointer border border-slate-200 shadow-xs shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tổng quan</span>
              </button>
            )}

            <div>
              <div className="text-[11.5px] text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md">
                {user.org_name || 'NGÂN HÀNG NÔNG NGHIỆP & PTNT VIỆT NAM - CHI NHÁNH QUẢNG BÌNH'}
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {user.role === 'ADMIN'
                  ? (activeView === 'menu_hub'
                      ? 'Trung tâm Điều hành & Thống kê 3P (Màn hình chính)'
                      : ADMIN_BLOCKS.flatMap((b) => b.items).find((i) => i.key === activeView)?.label || 'Quản trị Hệ thống')
                  : STAFF_TABS.find((t) => t.key === activeView)?.label || 'Cổng Cán bộ'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {availableYears && availableYears.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                <span className="text-xs font-bold text-slate-500">Năm:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => onChangeYear && onChangeYear(Number(e.target.value))}
                  className="text-xs sm:text-sm font-black text-emerald-900 bg-transparent focus:outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>Năm {yr}</option>
                  ))}
                </select>
              </div>
            )}

            {periods.length > 0 && (
              <div ref={periodBoxRef} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                <CalendarDays className="w-4 h-4 text-[#9E1B32]" />
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Kỳ làm việc:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => onChangePeriod(e.target.value)}
                  className="text-xs sm:text-sm font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {periods
                    .filter((p) => !selectedYear || (p.year_num || parseInt(p.period_code.split('-')[0], 10)) === selectedYear)
                    .map((p) => (
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

      {/* Popover gọn gàng cho chế độ thanh bên thu gọn (Collapsed Sidebar) */}
      {compactPopover && user.role === 'ADMIN' && (
        <>
          <div
            onClick={() => setCompactPopover(null)}
            className="no-print fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]"
          />
          <div
            ref={compactPopRef}
            style={{ top: `${compactPopover.top}px`, left: '80px' }}
            className="no-print fixed z-50 w-72 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className={`bg-gradient-to-r ${blockAccent[compactPopover.blk.id].header} text-white px-3.5 py-2 flex items-center justify-between`}>
              <span className="font-extrabold text-xs tracking-wide">{compactPopover.blk.title}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                {compactPopover.blk.items.length} mục
              </span>
            </div>
            <div className="p-1.5 space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto">
              {compactPopover.blk.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.key;
                const badgeVal = item.badgeKey === 'ksvPending' ? ksvPendingCount : 0;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setCompactPopover(null);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#9E1B32] text-white font-bold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {badgeVal > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-amber-500 text-white font-bold shrink-0">
                        {badgeVal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

