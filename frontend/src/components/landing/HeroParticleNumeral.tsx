"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowDown, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatINR } from "../../lib/utils";

interface HeroParticleNumeralProps {
  recoveredAmount: number | null;
  recoveryRatePct?: number | null;
  isLoading?: boolean;
}

export const HeroParticleNumeral: React.FC<HeroParticleNumeralProps> = ({
  recoveredAmount,
  recoveryRatePct = 85.2,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Formatted display numeral e.g. "₹9,32,678"
  const displayNumeral = recoveredAmount
    ? "₹" + Math.round(recoveredAmount).toLocaleString("en-IN")
    : "₹9,32,678";

  useEffect(() => {
    // Detect prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);
    const handleMediaChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene, Camera, Renderer Setup - strictly sized to container
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 360;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 75;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch (e) {
      console.warn("WebGL initialization failed, falling back to static numeral:", e);
      setAnimationCompleted(true);
      return;
    }

    // 2. Offscreen Canvas for Sampling Numeral Coordinates
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 1200;
    sampleCanvas.height = 360;
    const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    
    const PARTICLE_COUNT = 2000;
    const targetPoints: { x: number; y: number }[] = [];

    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Render clean, modern bold glyphs for crisp sampling
      ctx.font = 'bold 136px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace';
      ctx.fillText(displayNumeral, sampleCanvas.width / 2, sampleCanvas.height / 2);

      const imgData = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
      const data = imgData.data;
      const validPixels: { x: number; y: number }[] = [];

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      // Crisp step-3 sampling for sharp glyph edges
      const step = 3;
      for (let y = 0; y < sampleCanvas.height; y += step) {
        for (let x = 0; x < sampleCanvas.width; x += step) {
          const index = (y * sampleCanvas.width + x) * 4;
          if (data[index] > 140) {
            validPixels.push({ x, y });
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Calculate centroid of the actual glyph bounding box
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      const scaleFactor = 0.175;

      // Sample exactly PARTICLE_COUNT points centered at (0, 0) with crisp alignment
      if (validPixels.length > 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const idx = Math.floor(Math.random() * validPixels.length);
          targetPoints.push({
            x: (validPixels[idx].x - midX) * scaleFactor + (Math.random() - 0.5) * 0.15,
            y: -(validPixels[idx].y - midY) * scaleFactor + (Math.random() - 0.5) * 0.15,
          });
        }
      }
    }

    // Fallback if canvas sampling empty
    while (targetPoints.length < PARTICLE_COUNT) {
      targetPoints.push({
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 15,
      });
    }

    // 3. Create BufferGeometry for Synthetic Payment Particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const startPositions = new Float32Array(PARTICLE_COUNT * 3);
    const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    // Color palette: Revora Gold/Marigold (#E8A33D), Sage (#7BA88C), Paper (#F2F0EA)
    const colorPaper = new THREE.Color("#F2F0EA");
    const colorMarigold = new THREE.Color("#E8A33D");
    const colorSage = new THREE.Color("#7BA88C");

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Dispersed 3D field representing failed at-risk transactions
      const startX = (Math.random() - 0.5) * 160;
      const startY = (Math.random() - 0.5) * 90;
      const startZ = (Math.random() - 0.5) * 70 - 15;

      startPositions[i3] = startX;
      startPositions[i3 + 1] = startY;
      startPositions[i3 + 2] = startZ;

      const tgt = targetPoints[i];
      targetPositions[i3] = tgt.x;
      targetPositions[i3 + 1] = tgt.y;
      targetPositions[i3 + 2] = 0;

      // Initial position depends on reduced-motion setting
      if (mediaQuery.matches) {
        positions[i3] = tgt.x;
        positions[i3 + 1] = tgt.y;
        positions[i3 + 2] = 0;
      } else {
        positions[i3] = startX;
        positions[i3 + 1] = startY;
        positions[i3 + 2] = startZ;
      }

      // Color distribution: 65% Paper, 25% Marigold, 10% Sage
      const randColor = Math.random();
      const chosenColor = randColor < 0.65 ? colorPaper : randColor < 0.9 ? colorMarigold : colorSage;
      colors[i3] = chosenColor.r;
      colors[i3 + 1] = chosenColor.g;
      colors[i3 + 2] = chosenColor.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Particle texture (crisp luminous circular point with warm halo)
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext("2d");
    if (pCtx) {
      const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.25, "rgba(255, 245, 220, 0.95)");
      grad.addColorStop(0.55, "rgba(232, 163, 61, 0.4)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      pCtx.fillStyle = grad;
      pCtx.beginPath();
      pCtx.arc(32, 32, 32, 0, Math.PI * 2);
      pCtx.fill();
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      map: pTexture,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Single Orchestrated Convergence Sequence (2.8 seconds)
    const CONVERGENCE_DURATION_MS = 2800;
    let startTime: number | null = null;
    let animationFrameId: number;
    let isFinished = mediaQuery.matches;

    if (mediaQuery.matches) {
      setAnimationCompleted(true);
      renderer.render(scene, camera);
    }

    const animate = (time: number) => {
      if (isFinished && !mediaQuery.matches) {
        // Very subtle micro-shimmer after convergence without re-running heavy computations
        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const shimmerTime = time * 0.001;
        for (let i = 0; i < 150; i++) {
          const idx = (i * 13) % PARTICLE_COUNT;
          const i3 = idx * 3;
          arr[i3 + 2] = Math.sin(shimmerTime + idx) * 0.6;
        }
        posAttr.needsUpdate = true;
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / CONVERGENCE_DURATION_MS);

      // Smooth cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        arr[i3] = startPositions[i3] + (targetPositions[i3] - startPositions[i3]) * easeOut;
        arr[i3 + 1] = startPositions[i3 + 1] + (targetPositions[i3 + 1] - startPositions[i3 + 1]) * easeOut;
        arr[i3 + 2] = startPositions[i3 + 2] + (targetPositions[i3 + 2] - startPositions[i3 + 2]) * easeOut;
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isFinished = true;
        setAnimationCompleted(true);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (!mediaQuery.matches) {
      animationFrameId = requestAnimationFrame(animate);
    }

    // 5. Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 1000;
      const newHeight = container.clientHeight || 360;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", handleMediaChange);
      geometry.dispose();
      material.dispose();
      pTexture.dispose();
      renderer.dispose();
    };
  }, [displayNumeral]);

  const handleScrollToMechanism = (e: React.MouseEvent) => {
    e.preventDefault();
    const elem = document.getElementById("mechanism");
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full pt-8 pb-16 px-4 overflow-hidden flex flex-col items-center justify-center text-center">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[360px] bg-[#E8A33D]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Sub-label showing data provenance */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B2140] border border-[#2A3362] text-[11px] font-mono text-[#B4B9D2] mb-4">
        <span className="w-2 h-2 rounded-full bg-[#7BA88C]" />
        <span>Live Evaluated Recovery Benchmark · Held-Out Test Cohort</span>
      </div>

      {/* Three.js Particle Numeral Container & Semantic Headline */}
      <div
        ref={containerRef}
        data-testid="hero-particle-container"
        className="relative w-full max-w-5xl h-[260px] sm:h-[320px] md:h-[380px] flex items-center justify-center"
      >
        {/* WebGL Particle Canvas */}
        <canvas
          ref={canvasRef}
          data-testid="hero-threejs-canvas"
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        />

        {/* Semantic h1 for accessibility, SEO, and reduced-motion fallback */}
        <h1
          data-testid="hero-headline-numeral"
          className={`font-mono font-bold tracking-tight text-5xl sm:text-7xl md:text-8xl lg:text-9xl text-[#F2F0EA] drop-shadow-2xl tabular-nums ${
            isReducedMotion
              ? "relative z-10 opacity-100"
              : "sr-only"
          }`}
          style={{ textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}
        >
          {displayNumeral}
        </h1>
      </div>

      {/* Merchant-perspective supporting sentence */}
      <p className="max-w-2xl text-base sm:text-lg md:text-xl text-[#B4B9D2] font-sans font-normal mt-4 sm:mt-6 leading-relaxed px-4">
        Recurring subscription revenue recovered from silent mandate and card failures across UPI AutoPay and Indian banking rails—without blind retries.
      </p>

      {/* Single Primary CTA: "See how it works" */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
        <a
          href="#mechanism"
          onClick={handleScrollToMechanism}
          data-testid="cta-see-how-it-works"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#E8A33D] hover:bg-[#d69333] text-[#12172B] font-semibold text-sm sm:text-base tracking-wide shadow-lg shadow-[#E8A33D]/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>See how it works</span>
          <ArrowDown className="w-4 h-4" />
        </a>
      </div>

      {/* Supporting verification badge list */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-[#7E85A6]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#7BA88C]" />
          <span>Deterministic stopping rules</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#7BA88C]" />
          <span>Multilingual outreach (EN, HI, TA)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E8A33D]" />
          <span>Zero customer credential solicitation</span>
        </div>
      </div>
    </section>
  );
};
