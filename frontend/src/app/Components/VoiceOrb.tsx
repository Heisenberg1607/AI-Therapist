"use client";
import { useEffect, useRef } from "react";

interface VoiceOrbProps {
  level: number;
  active: boolean;
  className?: string;
  size?: number;
}

export const VoiceOrb = ({ level, active, className = "", size = 360 }: VoiceOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;

    const draw = () => {
      t += 0.016;
      const cx = size / 2;
      const cy = size / 2;
      ctx.clearRect(0, 0, size, size);

      const lvl = Math.max(0.05, levelRef.current);
      const bars = 64;
      const baseRadius = size * 0.22;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const noise =
          Math.sin(t * 2 + i * 0.5) * 0.3 +
          Math.sin(t * 3.5 + i * 0.21) * 0.2 +
          0.5;
        const amp = baseRadius * 0.6 * lvl * noise + baseRadius * 0.08;

        const x1 = cx + Math.cos(angle) * baseRadius;
        const y1 = cy + Math.sin(angle) * baseRadius;
        const x2 = cx + Math.cos(angle) * (baseRadius + amp);
        const y2 = cy + Math.sin(angle) * (baseRadius + amp);

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, "hsla(72, 100%, 70%, 0.9)");
        grad.addColorStop(1, "hsla(72, 100%, 60%, 0.05)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const glowScale = 1 + level * 0.3;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size * 1.5, height: size * 1.5 }}
    >
      {/* Outer concentric rings */}
      <div
        className="absolute rounded-full border border-white/5"
        style={{ width: size * 1.4, height: size * 1.4 }}
      />
      <div
        className="absolute rounded-full border border-white/10"
        style={{ width: size * 1.05, height: size * 1.05 }}
      />

      {/* Pulsing glow */}
      <div
        className="absolute rounded-full transition-transform duration-300 ease-out"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: "radial-gradient(circle, hsla(72, 100%, 70%, 0.35), transparent 70%)",
          filter: `blur(${40 + level * 30}px)`,
          transform: `scale(${glowScale})`,
          opacity: active ? 0.9 : 0.4,
        }}
      />

      {/* Reactive radial waveform canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10"
      />

      {/* Core sphere */}
      <div
        className="absolute z-20 rounded-full border border-white/20 flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          width: size * 0.32,
          height: size * 0.32,
          background: "radial-gradient(circle at 30% 30%, hsla(72, 100%, 70%, 0.25), hsl(240, 20%, 4%) 70%)",
          boxShadow: `inset 0 0 30px hsla(72, 100%, 70%, 0.3), 0 0 ${20 + level * 60}px hsla(72, 100%, 70%, ${0.3 + level * 0.4})`,
          transform: `scale(${1 + level * 0.08})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent" />
      </div>
    </div>
  );
};
