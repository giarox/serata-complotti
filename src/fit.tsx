import React, { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Text that shrinks to fit: at most `lines` lines and never wider than its box. Starts from the size the
 * stylesheet gives it and steps down (to `min` of it at most), so long names and qualifications stay
 * readable without pushing the rest of the slide around. Re-fits on resize and when fonts finish loading.
 */
export function Fit({
  as = 'p',
  lines = 2,
  min = 0.4,
  className,
  children,
}: {
  as?: 'p' | 'h1' | 'span' | 'strong' | 'em';
  lines?: number;
  min?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.removeProperty('font-size');
      const base = parseFloat(getComputedStyle(el).fontSize);
      const tooBig = () => {
        const cs = getComputedStyle(el),
          size = parseFloat(cs.fontSize),
          lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return el.scrollHeight - pad > lh * lines + 2 || el.scrollWidth > el.clientWidth + 1;
      };
      // 'important': the slide styles set their sizes with !important.
      for (let k = 1; k > min && tooBig(); k -= 0.04)
        el.style.setProperty('font-size', base * (k - 0.04) + 'px', 'important');
    };
    fit();
    // Re-fit only when the available width changes (our own resizing must not loop).
    const box = el.parentElement ?? el;
    let width = box.clientWidth,
      raf = 0;
    const ro = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(box);
    void document.fonts?.ready.then(fit);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [children, lines, min]);
  return React.createElement(as, { ref, className: 'fit ' + (className ?? '') }, children);
}
