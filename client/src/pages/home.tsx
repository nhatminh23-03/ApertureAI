import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Upload, Sparkles, ArrowRight, Image as ImageIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { SAMPLE_HISTORY } from "@/lib/mock-data";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wider uppercase mb-4 inline-block">
              AI-Powered Editing
            </span>
            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight tracking-tight text-foreground">
              Transform your photos <br />
              with <span className="text-gradient">intelligent magic</span>.
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Describe the edits you want in natural language, and let Aperture AI handle the rest. Simple, powerful, and beautiful.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 pt-4"
          >
            <GlassCard 
              className="p-12 w-full max-w-2xl border-dashed border-2 border-primary/20 flex flex-col items-center justify-center gap-4 group cursor-pointer transition-colors hover:border-primary/50 hover:bg-white/80"
              onClick={() => setLocation("/editor")}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-1">Drop your image here</h3>
                <p className="text-sm text-muted-foreground">or click to browse files</p>
              </div>
            </GlassCard>
          </motion.div>
        </section>

        {/* Quick Actions / Examples */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-heading font-semibold">Quick Start</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_HISTORY.map((item, i) => (
              <GlassCard 
                key={item.id} 
                hoverEffect 
                className="p-0 overflow-hidden group relative aspect-[4/3]"
                onClick={() => setLocation("/editor")}
              >
                <img 
                  src={item.image} 
                  alt="Example" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <p className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    {item.prompt}
                  </p>
                  <span className="text-white/70 text-xs">Try this style &rarr;</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
