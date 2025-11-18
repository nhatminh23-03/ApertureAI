import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export function GlassCard({ children, className, hoverEffect = false, ...props }: GlassCardProps) {
  return (
    <div 
      className={cn(
        "glass-panel rounded-3xl p-6",
        hoverEffect && "hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 cursor-pointer",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
