"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export function SwarmVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<"visualizer" | "feed">(
    "visualizer"
  );
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx!.scale(2, 2);
    }
    resize();

    const colors = ["#9945FF", "#14F195", "#00d4ff"];
    if (nodesRef.current.length === 0) {
      for (let i = 0; i < 40; i++) {
        nodesRef.current.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 1.5 + Math.random() * 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
    const nodes = nodesRef.current;
    let animId: number;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(153,69,255,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="panel overflow-hidden relative">
      <div className="flex items-center border-b border-panel-border">
        <button
          onClick={() => setActiveTab("visualizer")}
          className={`px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors ${
            activeTab === "visualizer"
              ? "text-sol-purple border-b border-sol-purple"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          SWARM_PULSE_VISUALIZER
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          className={`px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors ${
            activeTab === "feed"
              ? "text-sol-green border-b border-sol-green"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          LIVE_FEED
        </button>
        <div className="ml-auto px-4 text-[9px] text-gray-500 tracking-wider">
          Decorative visualization only. No live node data.
        </div>
      </div>
      <div className="relative h-[200px]">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-panel via-transparent to-transparent" />
      </div>
    </div>
  );
}
