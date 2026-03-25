import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ 
  children, 
  className = "", 
  hover = false,
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      className={`
        relative overflow-hidden
        backdrop-blur-[18px]
        border border-white/56
        ${hover ? "cursor-pointer transition-shadow duration-180" : ""}
        ${className}
      `}
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        borderRadius: "28px",
        boxShadow: "0 20px 50px rgba(74, 83, 97, 0.12)",
      }}
      whileHover={hover ? { 
        boxShadow: "0 24px 48px rgba(74, 83, 97, 0.18)",
      } : undefined}
      transition={{ duration: 0.18 }}
      onClick={onClick}
    >
      {/* 顶部高光线 */}
      <div 
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "rgba(255, 255, 255, 0.56)" }}
      />
      {children}
    </motion.div>
  );
}
