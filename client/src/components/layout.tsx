import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Nav } from "./nav";

interface LayoutProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function Layout({ children, className, fullWidth = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background overflow-x-hidden">
      <Nav />
      <main className={cn(
        "pt-24 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700",
        fullWidth ? "w-full px-4" : "container mx-auto px-4",
        className
      )}>
        {children}
      </main>
    </div>
  );
}
