import { useEffect, useRef } from "react";

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const bars = 80;
      const barW = w / bars;
      offsetRef.current += 0.03;

      for (let i = 0; i < bars; i++) {
        const t = i / bars;
        const amp =
          Math.sin(t * Math.PI * 3 + offsetRef.current) * 0.4 +
          Math.sin(t * Math.PI * 7 - offsetRef.current * 1.3) * 0.25 +
          Math.sin(t * Math.PI * 2 + offsetRef.current * 0.7) * 0.35;
        const barH = Math.max(2, (amp * 0.5 + 0.5) * h * 0.7);
        const x = i * barW + barW * 0.15;
        const y = (h - barH) / 2;

        const alpha = 0.15 + Math.abs(amp) * 0.6;
        ctx.fillStyle = `rgba(250, 250, 250, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW * 0.7, barH, 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
