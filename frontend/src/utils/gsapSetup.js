import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(useGSAP, Flip);
gsap.defaults({ ease: 'power2.out', duration: 0.28 });

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/**
 * Chạy animation GSAP chỉ khi hệ thống không bật prefers-reduced-motion.
 */
export function runReducedMotionAware(cb) {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => cb());
  return () => mm.revert();
}

/**
 * Hiệu ứng bật nhẹ (pop) khi người dùng chọn một mục, thẻ, tháng hoặc option.
 */
export function animateSelectionPop(el, scaleFrom = 0.962) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: scaleFrom },
    {
      scale: 1,
      duration: 0.28,
      ease: 'back.out(2.2)',
      overwrite: 'auto',
      clearProps: 'transform',
    }
  );
}

/**
 * Hiệu ứng xuất hiện mượt cho nội dung panel khi chuyển tab hoặc đổi nguồn dữ liệu.
 */
export function animateTabContentEnter(el, vars = {}) {
  if (!el || prefersReducedMotion()) return;
  return gsap.fromTo(
    el,
    { y: vars.y ?? 10, scale: vars.scale ?? 0.994, autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: vars.duration ?? 0.28,
      ease: 'power3.out',
      overwrite: 'auto',
      clearProps: 'transform,opacity,visibility',
    }
  );
}

/**
 * Gắn hiệu ứng Nhấn (tactile spring press) và Chọn (selection pop) trên toàn ứng dụng,
 * dùng GPU transform thuần và tự dọn inline style sau khi hoàn tất.
 */
export function installTactileInteractions() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let pressedEl = null;
  let active = true;

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: reduce)', () => {
    active = false;
    return () => {
      active = true;
    };
  });

  const findPressTarget = (evTarget) => {
    if (!evTarget || !(evTarget instanceof Element)) return null;
    const btn = evTarget.closest('button, [data-gsap-press]');
    if (!btn) return null;
    if (btn.matches(':disabled') || btn.getAttribute('aria-disabled') === 'true') return null;
    if (btn.hasAttribute('data-no-gsap-press')) return null;
    return btn;
  };

  const releasePressed = (spring = true) => {
    if (!pressedEl) return;
    const el = pressedEl;
    pressedEl = null;
    if (!active) return;
    gsap.to(el, {
      scale: 1,
      duration: spring ? 0.28 : 0.18,
      ease: spring ? 'back.out(2.3)' : 'power2.out',
      overwrite: 'auto',
      clearProps: 'transform',
    });
  };

  const onPointerDown = (e) => {
    if (!active || e.button > 0) return;
    const target = findPressTarget(e.target);
    if (!target) return;
    pressedEl = target;
    gsap.to(target, {
      scale: 0.965,
      duration: 0.085,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const onPointerUp = () => releasePressed(true);
  const onPointerCancel = () => releasePressed(false);

  const onChange = (e) => {
    if (!active) return;
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (el.matches('select, input[type="checkbox"], input[type="radio"]')) {
      const container = el.closest('label, .gsap-select-target') || el;
      animateSelectionPop(container, 0.972);
    }
  };

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerCancel, { passive: true });
  window.addEventListener('blur', onPointerCancel, { passive: true });
  document.addEventListener('change', onChange, { passive: true });

  return () => {
    document.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onPointerCancel);
    document.removeEventListener('change', onChange);
    mm.revert();
  };
}

export { gsap, useGSAP, Flip };
