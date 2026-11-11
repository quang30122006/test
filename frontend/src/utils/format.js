export function fmtMoney(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '0';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(val)));
}

export function fmtNum(val, digits = 2) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(val));
}

export function fmtPct(val, digits = 1) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '0%';
  return `${(Number(val) * 100).toFixed(digits)}%`;
}

export function ratingBadgeClass(rating) {
  switch (rating) {
    case 'A+':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    case 'A':
      return 'bg-sky-100 text-sky-800 border border-sky-300';
    case 'B':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'C':
      return 'bg-orange-100 text-orange-800 border border-orange-300';
    case 'D':
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

export function periodStatusBadge(status) {
  if (status === 'ĐANG MỞ') return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  if (status === 'ĐÃ KHÓA') return 'bg-slate-200 text-slate-700 border border-slate-300';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
}

export function ksvStatusBadge(status) {
  if (status === 'APPROVED') return { label: 'Đã chấp nhận', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
  if (status === 'REJECTED') return { label: 'Đã từ chối', cls: 'bg-rose-100 text-rose-800 border border-rose-300' };
  if (status === 'PENDING') return { label: 'Đang chờ KSV', cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
  return { label: 'Không áp dụng', cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
}

