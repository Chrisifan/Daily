import { useEffect, useRef, useCallback } from "react";
import type { WeatherCondition, WeatherTheme } from "../../domain/weather/types";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface ParticleBackgroundProps {
  condition: WeatherCondition;
  className?: string;
}

const weatherThemes: Record<WeatherCondition, WeatherTheme> = {
  sunny: {
    condition: "sunny",
    backgroundGradient: "linear-gradient(135deg, #1e3a5f 0%, #0d2137 50%, #1a365d 100%)",
    particleColor: "rgba(255, 223, 128, 0.6)",
    particleCount: 30,
    glassOpacity: 0.15,
    textColor: "#f0f9ff",
    accentColor: "#fbbf24"
  },
  cloudy: {
    condition: "cloudy",
    backgroundGradient: "linear-gradient(135deg, #2d3748 0%, #1a202c 50%, #2d3748 100%)",
    particleColor: "rgba(160, 174, 192, 0.5)",
    particleCount: 50,
    glassOpacity: 0.12,
    textColor: "#e2e8f0",
    accentColor: "#a0aec0"
  },
  rainy: {
    condition: "rainy",
    backgroundGradient: "linear-gradient(135deg, #1a202c 0%, #0d1117 50%, #1a202c 100%)",
    particleColor: "rgba(100, 149, 237, 0.4)",
    particleCount: 80,
    glassOpacity: 0.1,
    textColor: "#cbd5e0",
    accentColor: "#63b3ed"
  },
  snow: {
    condition: "snow",
    backgroundGradient: "linear-gradient(135deg, #2d3748 0%, #1a202c 50%, #2d3748 100%)",
    particleColor: "rgba(255, 255, 255, 0.7)",
    particleCount: 60,
    glassOpacity: 0.12,
    textColor: "#f7fafc",
    accentColor: "#e2e8f0"
  },
  night: {
    condition: "night",
    backgroundGradient: "linear-gradient(135deg, #0f172a 0%, #020617 50%, #0f172a 100%)",
    particleColor: "rgba(200, 200, 255, 0.4)",
    particleCount: 45,
    glassOpacity: 0.1,
    textColor: "#e2e8f0",
    accentColor: "#818cf8"
  },
  overcast: {
    condition: "overcast",
    backgroundGradient: "linear-gradient(135deg, #374151 0%, #1f2937 50%, #374151 100%)",
    particleColor: "rgba(156, 163, 175, 0.3)",
    particleCount: 20,
    glassOpacity: 0.1,
    textColor: "#f3f4f6",
    accentColor: "#9ca3af"
  },
  haze: {
    condition: "haze",
    backgroundGradient: "linear-gradient(135deg, #78716c 0%, #57534e 50%, #78716c 100%)",
    particleColor: "rgba(217, 119, 6, 0.25)",
    particleCount: 35,
    glassOpacity: 0.08,
    textColor: "#fef3c7",
    accentColor: "#d97706"
  },
  thunderstorm: {
    condition: "thunderstorm",
    backgroundGradient: "linear-gradient(135deg, #0d1117 0%, #000000 50%, #0d1117 100%)",
    particleColor: "rgba(147, 112, 219, 0.5)",
    particleCount: 40,
    glassOpacity: 0.08,
    textColor: "#a0aec0",
    accentColor: "#9f7aea"
  }
};

export function ParticleBackground({ condition, className = "" }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const theme = weatherThemes[condition];

  const createParticle = useCallback((canvas: HTMLCanvasElement): Particle => {
    const size = Math.random() * 2 + 0.5;
    const speedMultiplier = condition === "rainy" ? 3 : condition === "snow" ? 0.5 : 0.3;
    
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size,
      speedX: (Math.random() - 0.5) * speedMultiplier,
      speedY: condition === "rainy" ? Math.random() * 4 + 2 : (Math.random() - 0.5) * speedMultiplier,
      opacity: Math.random() * 0.5 + 0.2,
      life: 0,
      maxLife: Math.random() * 200 + 100
    };
  }, [condition]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    particlesRef.current = Array.from({ length: theme.particleCount }, () => 
      createParticle(canvas)
    );

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.life++;

        // Reset particle if out of bounds or life ended
        if (
          particle.x < 0 || 
          particle.x > canvas.width || 
          particle.y < 0 || 
          particle.y > canvas.height ||
          particle.life > particle.maxLife
        ) {
          particlesRef.current[index] = createParticle(canvas);
          if (condition === "rainy") {
            particlesRef.current[index].y = -10;
            particlesRef.current[index].x = Math.random() * canvas.width;
          }
        }

        // Draw particle
        const lifeRatio = 1 - particle.life / particle.maxLife;
        const currentOpacity = particle.opacity * lifeRatio;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = theme.particleColor.replace(/[\d.]+\)$/, `${currentOpacity})`);
        ctx.fill();

        // Draw trail for rainy effect
        if (condition === "rainy") {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x - particle.speedX * 3, particle.y - particle.speedY * 3);
          ctx.strokeStyle = theme.particleColor.replace(/[\d.]+\)$/, `${currentOpacity * 0.5})`);
          ctx.lineWidth = particle.size * 0.5;
          ctx.stroke();
        }
      });

      // Draw connections for galaxy effect (night/sunny)
      if (condition === "night" || condition === "sunny") {
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
              const opacity = (1 - distance / 100) * 0.15;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = theme.particleColor.replace(/[\d.]+\)$/, `${opacity})`);
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [condition, theme, createParticle]);

  return (
    <div 
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ background: theme.backgroundGradient }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
    </div>
  );
}

export { weatherThemes };
export type { WeatherTheme };
