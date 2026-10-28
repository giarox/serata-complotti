import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** One brass laurel branch, drawn leaf by leaf; the right one is mirrored. */
export function Laurel({ right = false }: { right?: boolean }) {
  // Stem: a quadratic curve from the bottom (inner side) up and outward.
  const P0 = [78, 236],
    P1 = [-6, 150],
    P2 = [44, 8];
  const at = (t: number) => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const t = 0.08 + i * 0.105,
      [x, y] = at(t),
      [x2, y2] = at(t + 0.01),
      dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    return [
      { x, y, rot: dir - 38, k: 1 - i * 0.045 },
      { x, y, rot: dir + 38, k: 1 - i * 0.045 },
    ];
  }).flat();
  return (
    <svg
      className={'pj-laurel' + (right ? ' right' : '')}
      viewBox="0 0 100 240"
      aria-hidden="true"
      style={right ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d={`M ${P0} Q ${P1} ${P2}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <path
          key={i}
          d="M 0 0 C 8 -7 22 -7 30 0 C 22 7 8 7 0 0 Z"
          transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.k * 0.72})`}
          fill="currentColor"
        />
      ))}
      <ellipse cx="44" cy="8" rx="6" ry="9" fill="currentColor" transform="rotate(20 44 8)" />
    </svg>
  );
}
/**
 * Confetti that bursts out of the winner's name, flies up and floats down: flat squares and discs that
 * flip as they fall (they look thinner, then wider), with a little side wobble. Canvas, one burst, then gone.
 */
const confettiColors = [
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#009688',
  '#4caf50',
  '#8bc34a',
  '#cddc39',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
];
export function ConfettiBurst() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!,
      dpr = Math.min(devicePixelRatio || 1, 2),
      W = innerWidth,
      H = innerHeight,
      k = H / 1080; // same look on any projector resolution
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const name = document.querySelector('.pj-award .pj-name')?.getBoundingClientRect();
    const ox = name ? name.left + name.width / 2 : W / 2,
      oy = name ? name.top + name.height / 2 : H / 2,
      spread = name ? name.width / 2 : 100;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const parts = Array.from({ length: 320 }, () => {
      const angle = rnd(-Math.PI * 0.92, -Math.PI * 0.08),
        speed = rnd(9, 25) * k;
      return {
        x: ox + rnd(-spread, spread),
        y: oy + rnd(-20, 20) * k,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        friction: rnd(0.975, 0.99),
        size: Math.round(rnd(7, 17) * k),
        square: Math.random() < 0.5,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        wobble: rnd(-0.02, 0.02),
        wobbleAmp: rnd(0.01, 0.08),
        wobbleAngle: rnd(0, Math.PI * 2),
      };
    });
    const gravity = 0.26 * k;
    let frame = 0,
      alive = true;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let left = 0;
      for (const p of parts) {
        if (p.y > H + 40) continue;
        left++;
        p.vy += gravity;
        p.vx += p.wobble + Math.cos(p.wobbleAngle) * p.wobbleAmp;
        p.wobbleAngle += 0.05;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.vx * 0.2);
        ctx.scale(1, 0.5 + Math.sin(p.vy * 2 + p.wobbleAngle * 3) * 0.5); // the flip
        ctx.fillStyle = p.color;
        if (p.square) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (left && alive) frame = requestAnimationFrame(tick);
    };
    const start = window.setTimeout(() => (frame = requestAnimationFrame(tick)), 250);
    return () => {
      alive = false;
      clearTimeout(start);
      cancelAnimationFrame(frame);
    };
  }, [canvas]);
  // On the body: no ancestor's layout or transform can move or clip it.
  return createPortal(<canvas ref={setCanvas} className="pj-confetti" aria-hidden="true" />, document.body);
}
