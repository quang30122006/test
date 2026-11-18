import React from 'react';

/**
 * Khung xương Skeleton Shimmer cơ bản
 */
export function Skeleton({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />;
}

/**
 * Skeleton Wireframe cho Trung tâm Điều hành (AdminMenuHub)
 */
export function AdminHubSkeleton() {
  return (
    <div className="space-y-5 animate-pulse-none">
      {/* Hero Banner Skeleton */}
      <div className="rounded-2xl p-6 bg-slate-200 skeleton-shimmer h-44 flex flex-col justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48 bg-slate-300" />
          <Skeleton className="h-7 w-80 bg-slate-300" />
          <Skeleton className="h-4 w-96 bg-slate-300" />
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-32 bg-slate-300" />
          <Skeleton className="h-8 w-32 bg-slate-300" />
          <Skeleton className="h-8 w-24 bg-slate-300" />
        </div>
      </div>

      {/* 4 Thẻ KPI Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Khu vực Trung tâm 2 Cột */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cột trái (7/12) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((k) => (
                  <Skeleton key={k} className="h-6 w-full" />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-2">
                {[1, 2, 3].map((k) => (
                  <Skeleton key={k} className="h-10 w-full" />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <Skeleton className="h-4 w-56" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <Skeleton key={m} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Cột phải (5/12) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <Skeleton className="h-4 w-44" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((k) => (
                <Skeleton key={k} className="h-9 w-full" />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((k) => (
                <Skeleton key={k} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Wireframe cho Dashboard Điều hành (DashboardView)
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Skeleton cho Bảng dữ liệu (Table)
 */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-full bg-slate-100" />
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className="h-7 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

