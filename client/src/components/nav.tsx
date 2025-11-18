import { Link, useLocation } from "wouter";
import { Aperture, History, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const [location] = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/50 backdrop-blur-md dark:bg-black/20">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform">
              <Aperture className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">Aperture AI</span>
          </a>
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/editor">
            <a className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              location === "/editor" 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
            )}>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Editor</span>
            </a>
          </Link>
          <Link href="/history">
            <a className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              location === "/history" 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
            )}>
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </a>
          </Link>
        </div>
      </div>
    </nav>
  );
}
