import { useEffect, useRef, useCallback } from "react";
import type { WeatherCondition } from "../../domain/weather/types";

interface WeatherBackgroundProps {
  condition: WeatherCondition;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation?: number;
  rotationSpeed?: number;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
  layers: { ox: number; oy: number; r: number }[];
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
  rotation: number;
  rotationSpeed: number;
}

interface Lightning {
  x: number;
  y: number;
  segments: { x: number; y: number }[];
  opacity: number;
  life: number;
}

export function WeatherBackground({ condition }: WeatherBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const rainDropsRef = useRef<RainDrop[]>([]);
  const snowflakesRef = useRef<Snowflake[]>([]);
  const lightningRef = useRef<Lightning | null>(null);
  const lightningTimerRef = useRef<number>(0);
  const hazeParticlesRef = useRef<Particle[]>([]);

  const initSunny = useCallback((canvas: HTMLCanvasElement) => {
    particlesRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.6 + 0.2,
    }));
  }, []);

  const initClouds = useCallback((canvas: HTMLCanvasElement, dark = false) => {
    cloudsRef.current = Array.from({ length: 5 }, () => {
      const width = Math.random() * 150 + 100;
      const height = Math.random() * 50 + 40;
      const layerCount = Math.floor(Math.random() * 3) + 4;
      const layers = Array.from({ length: layerCount }, () => ({
        ox: (Math.random() - 0.5) * width * 0.6,
        oy: (Math.random() - 0.5) * height * 0.4,
        r: Math.random() * 30 + 20,
      }));
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.6,
        width,
        height,
        speed: Math.random() * 0.3 + 0.1,
        opacity: dark ? Math.random() * 0.4 + 0.3 : Math.random() * 0.5 + 0.4,
        layers,
      };
    });
  }, []);

  const initRain = useCallback((canvas: HTMLCanvasElement) => {
    rainDropsRef.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 20 + 10,
      speed: Math.random() * 15 + 10,
      opacity: Math.random() * 0.4 + 0.2,
    }));
  }, []);

  const initSnow = useCallback((canvas: HTMLCanvasElement) => {
    snowflakesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 1.5 + 0.5,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.01,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
    }));
  }, []);

  const initHaze = useCallback((canvas: HTMLCanvasElement) => {
    hazeParticlesRef.current = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 80 + 40,
      speedX: Math.random() * 0.3 + 0.1,
      speedY: (Math.random() - 0.5) * 0.1,
      opacity: Math.random() * 0.15 + 0.05,
    }));
  }, []);

  const drawSunny = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, _time: number) => {
    const sunX = canvas.width * 0.8;
    const sunY = canvas.height * 0.3;
    const sunRadius = Math.min(canvas.width, canvas.height) * 0.15;

    const glowGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 2.5);
    glowGradient.addColorStop(0, "rgba(255, 250, 200, 1)");
    glowGradient.addColorStop(0.15, "rgba(255, 240, 160, 0.9)");
    glowGradient.addColorStop(0.4, "rgba(255, 220, 120, 0.5)");
    glowGradient.addColorStop(0.7, "rgba(255, 200, 80, 0.15)");
    glowGradient.addColorStop(1, "rgba(255, 180, 60, 0)");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    particlesRef.current.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${p.opacity * 0.6})`;
      ctx.fill();
    });
  }, []);

  const drawClouds = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dark = false) => {
    cloudsRef.current.forEach((cloud) => {
      cloud.x += cloud.speed;
      if (cloud.x > canvas.width + cloud.width) {
        cloud.x = -cloud.width;
      }

      const baseAlpha = dark ? 0.25 : 0.35;

      cloud.layers.forEach((layer, i) => {
        const layerX = cloud.x + layer.ox;
        const layerY = cloud.y + layer.oy;
        const r = layer.r;

        const alpha = baseAlpha * (0.7 + i * 0.05);
        const baseColor = dark 
          ? `rgba(90, 100, 115, ${alpha})` 
          : `rgba(255, 255, 255, ${alpha})`;

        ctx.beginPath();
        ctx.arc(layerX, layerY, r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 0.6, layerY - r * 0.2, r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 1.1, layerY + r * 0.1, r * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX - r * 0.5, layerY + r * 0.15, r * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 0.3, layerY + r * 0.4, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, []);

  const drawOvercast = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(180, 185, 195, 0.25)");
    gradient.addColorStop(1, "rgba(150, 155, 165, 0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    cloudsRef.current.forEach((cloud) => {
      cloud.x += cloud.speed * 0.5;
      if (cloud.x > canvas.width + cloud.width) {
        cloud.x = -cloud.width;
        cloud.y = Math.random() * canvas.height * 0.5;
      }

      const baseAlpha = 0.3;

      cloud.layers.forEach((layer, i) => {
        const layerX = cloud.x + layer.ox;
        const layerY = cloud.y + layer.oy + Math.sin(time * 0.001 + cloud.x) * 2;
        const r = layer.r * 1.2;
        const gray = 110 + i * 8;

        const alpha = baseAlpha * (0.8 + i * 0.05);

        ctx.beginPath();
        ctx.arc(layerX, layerY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray + 8}, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 0.7, layerY - r * 0.15, r * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 1.2, layerY + r * 0.1, r * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX - r * 0.5, layerY + r * 0.2, r * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 0.3, layerY + r * 0.5, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, []);

  const drawRainy = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(100, 120, 150, 0.35)");
    gradient.addColorStop(1, "rgba(80, 100, 130, 0.45)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    rainDropsRef.current.forEach((drop) => {
      drop.y += drop.speed;
      drop.x -= drop.speed * 0.1;
      if (drop.y > canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * canvas.width * 1.2;
      }

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.length * 0.1, drop.y - drop.length);
      ctx.strokeStyle = `rgba(120, 150, 180, ${drop.opacity * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    drawClouds(ctx, canvas, true);
  }, [drawClouds]);

  const drawThunderstorm = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, _time: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(70, 85, 110, 0.5)");
    gradient.addColorStop(1, "rgba(50, 65, 90, 0.6)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    rainDropsRef.current.forEach((drop) => {
      drop.y += drop.speed * 1.5;
      drop.x -= drop.speed * 0.2;
      if (drop.y > canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * canvas.width * 1.3;
      }

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.length * 0.15, drop.y - drop.length * 1.5);
      ctx.strokeStyle = `rgba(100, 130, 170, ${drop.opacity * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    cloudsRef.current.forEach((cloud) => {
      cloud.x += cloud.speed * 0.8;
      if (cloud.x > canvas.width + cloud.width) {
        cloud.x = -cloud.width;
      }

      const baseAlpha = 0.4;

      cloud.layers.forEach((layer, i) => {
        const layerX = cloud.x + layer.ox;
        const layerY = cloud.y + layer.oy;
        const r = layer.r * 1.2;

        const alpha = baseAlpha * (0.7 + i * 0.05);

        ctx.beginPath();
        ctx.arc(layerX, layerY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(50, 60, 80, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 0.7, layerY - r * 0.15, r * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX + r * 1.2, layerY + r * 0.1, r * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(layerX - r * 0.5, layerY + r * 0.2, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    lightningTimerRef.current++;
    if (lightningTimerRef.current > 120 + Math.random() * 180) {
      lightningTimerRef.current = 0;
      lightningRef.current = {
        x: Math.random() * canvas.width,
        y: 0,
        segments: [{ x: 0, y: 0 }],
        opacity: 1,
        life: 15,
      };

      let lx = lightningRef.current.x;
      let ly = 0;
      for (let i = 0; i < 8; i++) {
        lx += (Math.random() - 0.4) * 40;
        ly += canvas.height / 8;
        lightningRef.current.segments.push({ x: lx - lightningRef.current.x, y: ly });
      }
    }

    if (lightningRef.current && lightningRef.current.life > 0) {
      const flash = lightningRef.current.life > 10 ? 1 : lightningRef.current.life / 10;
      ctx.fillStyle = `rgba(200, 210, 255, ${flash * 0.3})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.moveTo(
        lightningRef.current.x + lightningRef.current.segments[0].x,
        lightningRef.current.y + lightningRef.current.segments[0].y
      );
      lightningRef.current.segments.forEach((seg) => {
        ctx.lineTo(lightningRef.current!.x + seg.x, lightningRef.current!.y + seg.y);
      });
      ctx.strokeStyle = `rgba(255, 255, 255, ${lightningRef.current.opacity})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      lightningRef.current.life--;
      lightningRef.current.opacity = lightningRef.current.life / 15;
    }
  }, [drawClouds]);

  const drawHaze = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, _time: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(180, 170, 160, 0.4)");
    gradient.addColorStop(0.5, "rgba(200, 185, 175, 0.35)");
    gradient.addColorStop(1, "rgba(160, 150, 140, 0.45)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    hazeParticlesRef.current.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x > canvas.width + p.size) {
        p.x = -p.size;
        p.y = Math.random() * canvas.height;
      }

      const hazeGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      hazeGradient.addColorStop(0, `rgba(180, 160, 140, ${p.opacity})`);
      hazeGradient.addColorStop(1, "rgba(180, 160, 140, 0)");

      ctx.fillStyle = hazeGradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const drawSnow = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(180, 195, 215, 0.4)");
    gradient.addColorStop(1, "rgba(160, 175, 200, 0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    snowflakesRef.current.forEach((flake) => {
      flake.y += flake.speed;
      flake.wobble += flake.wobbleSpeed;
      flake.x += Math.sin(flake.wobble) * 0.5;
      flake.rotation += flake.rotationSpeed;

      if (flake.y > canvas.height + 10) {
        flake.y = -10;
        flake.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate(flake.rotation);
      ctx.font = `${flake.size * 2}px serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + Math.sin(time * 0.01 + flake.x) * 0.3})`;
      ctx.fillText("❄", -flake.size / 2, flake.size / 2);
      ctx.restore();
    });
  }, []);

  const drawNight = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(40, 50, 90, 0.4)");
    gradient.addColorStop(0.5, "rgba(50, 60, 100, 0.35)");
    gradient.addColorStop(1, "rgba(60, 70, 110, 0.45)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const moonX = canvas.width * 0.75;
    const moonY = canvas.height * 0.2;
    const moonRadius = Math.min(canvas.width, canvas.height) * 0.08;

    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 3);
    moonGlow.addColorStop(0, "rgba(200, 210, 255, 0.4)");
    moonGlow.addColorStop(0.5, "rgba(150, 170, 220, 0.15)");
    moonGlow.addColorStop(1, "rgba(100, 130, 200, 0)");
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(230, 235, 255, 0.95)";
    ctx.fill();

    particlesRef.current.forEach((star, i) => {
      star.x += star.speedX * 0.1;
      star.y += star.speedY * 0.1;
      if (star.x < 0) star.x = canvas.width;
      if (star.x > canvas.width) star.x = 0;
      if (star.y < 0) star.y = canvas.height;
      if (star.y > canvas.height) star.y = 0;

      const twinkle = Math.sin(time * 0.003 + i) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
      ctx.fill();
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;

      if (condition === "sunny" || condition === "night") {
        initSunny(canvas);
      } else if (condition === "cloudy") {
        initClouds(canvas, false);
      } else if (condition === "overcast") {
        initClouds(canvas, true);
      } else if (condition === "rainy" || condition === "thunderstorm") {
        initRain(canvas);
        initClouds(canvas, true);
      } else if (condition === "haze") {
        initHaze(canvas);
      } else if (condition === "snow") {
        initSnow(canvas);
      }
    };

    resize();

    const handleResize = () => {
      resize();
    };
    window.addEventListener("resize", handleResize);

    let initialized = false;
    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      switch (condition) {
        case "sunny":
          if (!initialized) { initSunny(canvas); initialized = true; }
          drawSunny(ctx, canvas, time);
          break;
        case "cloudy":
          if (!initialized) { initClouds(canvas, false); initialized = true; }
          drawClouds(ctx, canvas, false);
          break;
        case "overcast":
          if (!initialized) { initClouds(canvas, true); initialized = true; }
          drawOvercast(ctx, canvas, time);
          break;
        case "rainy":
          if (!initialized) { initRain(canvas); initClouds(canvas, true); initialized = true; }
          drawRainy(ctx, canvas);
          break;
        case "thunderstorm":
          if (!initialized) { initRain(canvas); initClouds(canvas, true); initialized = true; }
          drawThunderstorm(ctx, canvas, time);
          break;
        case "haze":
          if (!initialized) { initHaze(canvas); initialized = true; }
          drawHaze(ctx, canvas, time);
          break;
        case "snow":
          if (!initialized) { initSnow(canvas); initialized = true; }
          drawSnow(ctx, canvas, time);
          break;
        case "night":
          if (!initialized) { initSunny(canvas); initialized = true; }
          drawNight(ctx, canvas, time);
          break;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [condition, initSunny, initClouds, initRain, initSnow, initHaze, drawSunny, drawClouds, drawOvercast, drawRainy, drawThunderstorm, drawHaze, drawSnow, drawNight]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 rounded-[32px_32px_38px_28px] overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
