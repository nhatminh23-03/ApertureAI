import { Layout } from "@/components/layout";
import { GlassCard } from "@/components/ui/glass-card";
import { Upload, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const res = await apiRequest("POST", "/api/upload", {
              imageUrl: base64,
              prompt: "",
              status: "pending"
            });
            resolve(await res.json());
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    onSuccess: (data: any) => {
      setLocation(`/editor?id=${data.id}`);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again with a smaller image.",
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit client-side check
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      uploadMutation.mutate(file);
    }
  };

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
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
            <GlassCard 
              className="p-12 w-full max-w-2xl border-dashed border-2 border-primary/20 flex flex-col items-center justify-center gap-4 group cursor-pointer transition-colors hover:border-primary/50 hover:bg-white/80"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Upload className={`w-8 h-8 text-primary ${uploadMutation.isPending ? 'animate-bounce' : ''}`} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-1">
                  {uploadMutation.isPending ? "Uploading..." : "Drop your image here"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {uploadMutation.isPending ? "Please wait" : "or click to browse files"}
                </p>
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
            {/* Static examples remain for inspiration */}
            <GlassCard 
              hoverEffect 
              className="p-0 overflow-hidden group relative aspect-[4/3]"
              onClick={() => fileInputRef.current?.click()}
            >
              <img 
                src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=60" 
                alt="Example" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Enhance colors
                </p>
                <span className="text-white/70 text-xs">Try your own &rarr;</span>
              </div>
            </GlassCard>
             <GlassCard 
              hoverEffect 
              className="p-0 overflow-hidden group relative aspect-[4/3]"
              onClick={() => fileInputRef.current?.click()}
            >
              <img 
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop&q=60" 
                alt="Example" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Remove background
                </p>
                <span className="text-white/70 text-xs">Try your own &rarr;</span>
              </div>
            </GlassCard>
             <GlassCard 
              hoverEffect 
              className="p-0 overflow-hidden group relative aspect-[4/3]"
              onClick={() => fileInputRef.current?.click()}
            >
              <img 
                src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=60" 
                alt="Example" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Cinematic look
                </p>
                <span className="text-white/70 text-xs">Try your own &rarr;</span>
              </div>
            </GlassCard>
          </div>
        </section>
      </div>
    </Layout>
  );
}
