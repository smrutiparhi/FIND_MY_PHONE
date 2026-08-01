import { useEffect, useRef, type ReactElement } from 'react';

const CHARS = '01001101010$#%&<>/\\{}[]=+*ABCDEF'.split('');
const FONT_SIZE = 16;
const FRAME_MS = 45;

/**
 * Ambient "matrix rain" canvas behind the whole app - cyan/magenta code
 * streams matching the cyberpunk neon direction. Fixed, pointer-events:none,
 * low opacity so foreground text/panels stay fully legible on top; skips
 * the animation loop entirely under prefers-reduced-motion (renders a
 * single static frame instead of nothing, so the effect still reads as
 * "there" without motion).
 */
export function DigitalRainBackground(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let columns = 0;
    let drops: number[] = [];

    function resize(): void {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.ceil(canvas.width / FONT_SIZE);
      drops = new Array(columns).fill(0).map(() => Math.floor((Math.random() * canvas.height) / FONT_SIZE));
    }

    function drawFrame(): void {
      if (!canvas || !ctx) return;
      ctx.fillStyle = 'rgba(3, 4, 8, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)] ?? '0';
        const row = drops[i] ?? 0;
        const x = i * FONT_SIZE;
        const y = row * FONT_SIZE;
        ctx.fillStyle = Math.random() < 0.08 ? 'rgba(255, 43, 214, 0.75)' : 'rgba(0, 240, 255, 0.7)';
        ctx.fillText(char, x, y);

        drops[i] = y > canvas.height && Math.random() > 0.975 ? 0 : row + 1;
      }
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      // One faint static pass instead of a running animation.
      ctx.fillStyle = 'rgba(3, 4, 8, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawFrame();
      return () => window.removeEventListener('resize', resize);
    }

    const interval = window.setInterval(drawFrame, FRAME_MS);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ opacity: 0.22 }}
    />
  );
}
