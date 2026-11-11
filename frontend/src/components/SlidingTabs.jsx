import React, { useLayoutEffect, useRef } from 'react';
import { gsap, useGSAP, animateSelectionPop } from '../utils/gsapSetup';

/**
 * Thanh chuyển Tab có nền trượt mượt bằng GSAP (GPU x/y + co giãn chính xác theo từng tab,
 * hỗ trợ cả grid cố định lẫn flex-wrap nhiều dòng và ResizeObserver).
 */
export default function SlidingTabs({
  items = [],
  value,
  onChange,
  className = '',
  pillClassName = 'bg-[#9E1B32] shadow-sm rounded-xl',
  pillStyleMap = null,
  activeTextClass = 'text-white',
  inactiveTextClass = 'text-slate-600 hover:text-slate-900',
  buttonClassName = 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold',
}) {
  const wrapRef = useRef(null);
  const pillRef = useRef(null);
  const btnRefs = useRef({});
  const isFirstRef = useRef(true);

  const syncPill = (animate = true) => {
    const wrap = wrapRef.current;
    const pill = pillRef.current;
    const activeBtn = btnRefs.current[value];
    if (!wrap || !pill || !activeBtn) return;

    const target = {
      x: activeBtn.offsetLeft,
      y: activeBtn.offsetTop,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight,
    };

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (!animate || reduced) {
      gsap.set(pill, { ...target, autoAlpha: 1 });
      return;
    }

    gsap.to(pill, {
      ...target,
      autoAlpha: 1,
      duration: 0.34,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  };

  useGSAP(() => {
    const shouldAnimate = !isFirstRef.current;
    isFirstRef.current = false;
    syncPill(shouldAnimate);
    if (shouldAnimate && btnRefs.current[value]) {
      animateSelectionPop(btnRefs.current[value], 0.96);
    }
  }, { scope: wrapRef, dependencies: [value, items.length] });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncPill(false));
    ro.observe(wrap);
    document.fonts?.ready?.then(() => syncPill(false));
    return () => ro.disconnect();
  }, [value]);

  const currentPillClass = (pillStyleMap && pillStyleMap[value]) || pillClassName;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <span
        ref={pillRef}
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 left-0 opacity-0 transition-colors duration-200 ${currentPillClass}`}
      />
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === value;
        const activeCls = item.activeTextClass || activeTextClass;
        const inactiveCls = item.inactiveTextClass || inactiveTextClass;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) btnRefs.current[item.id] = el;
            }}
            type="button"
            onClick={() => {
              if (item.id !== value) onChange(item.id);
            }}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${buttonClassName} ${
              isActive ? activeCls : inactiveCls
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
