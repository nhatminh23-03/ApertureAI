import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SUGGESTION_CHIPS } from "@/lib/mock-data";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, SlidersHorizontal, Undo2, Wand2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import stockImage from '@assets/stock_images/scenic_landscape_pho_0c147bc2.jpg';

export default function Editor() {
  const [step, setStep] = useState<"prompt" | "processing" | "preview">("prompt");
  const [prompt, setPrompt] = useState("");
  const [intensity, setIntensity] = useState([50]);

  // Simulate processing
  const handleGenerate = () => {
    if (!prompt) return;
    setStep("processing");
    setTimeout(() => {
      setStep("preview");
    }, 2500);
  };

  return (
    <Layout fullWidth className="h-[calc(100vh-6rem)] flex flex-col">
      
      {/* Top Bar - Contextual Actions */}
      <div className="flex items-center justify-between mb-6 px-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        
        {step === "preview" && (
           <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setStep("prompt")}>
               <Undo2 className="w-4 h-4" />
               Undo
             </Button>
             <Button variant="outline" size="sm" className="gap-2 rounded-full">
               <RefreshCw className="w-4 h-4" />
               Regenerate
             </Button>
             <Button size="sm" className="gap-2 rounded-full bg-gradient-primary border-0 shadow-lg shadow-primary/20">
               <Check className="w-4 h-4" />
               Accept
             </Button>
           </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-6">
        
        {/* Left Panel: Image Preview */}
        <div className="lg:col-span-8 h-full relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black/5 dark:bg-white/5">
          <AnimatePresence mode="wait">
            {step === "processing" ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50 text-white"
              >
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium animate-pulse">Magic is happening...</p>
                <p className="text-sm text-white/50 mt-2">Analyzing pixels • Enhancing details</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {step === "preview" ? (
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="relative h-full w-full">
                  <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 text-white text-xs rounded-full backdrop-blur-md z-10">Original</div>
                  <img src={stockImage} className="w-full h-full object-cover" alt="Original" />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={30}>
                 <div className="relative h-full w-full">
                  <div className="absolute top-4 right-4 px-3 py-1 bg-primary/90 text-white text-xs rounded-full backdrop-blur-md z-10">Edited</div>
                  <img 
                    src={stockImage} 
                    className="w-full h-full object-cover filter contrast-125 saturate-125 brightness-110" 
                    alt="Edited" 
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full w-full relative">
              <img src={stockImage} className="w-full h-full object-cover" alt="Preview" />
            </div>
          )}
        </div>

        {/* Right Panel: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <GlassCard className="flex-1 flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-heading font-semibold mb-2">
                {step === "preview" ? "Adjustments" : "Magic Editor"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {step === "preview" 
                  ? "Fine-tune the intensity of the generated edit." 
                  : "Describe what you want to change in this image."}
              </p>
            </div>

            {step === "preview" ? (
              <div className="space-y-8 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Effect Strength</span>
                    <span className="text-primary">{intensity}%</span>
                  </div>
                  <Slider 
                    value={intensity} 
                    onValueChange={setIntensity} 
                    max={100} 
                    step={1} 
                    className="cursor-pointer"
                  />
                </div>
                
                <div className="p-4 rounded-xl bg-muted/50 border border-white/10 text-sm text-muted-foreground">
                  <p>AI applied: <span className="text-foreground font-medium">"{prompt}"</span></p>
                </div>

                <Button className="w-full gap-2" variant="outline">
                  <Download className="w-4 h-4" /> Export Image
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 h-full">
                <div className="relative">
                  <Textarea 
                    placeholder="e.g. Make the sky more dramatic, remove the person in background..." 
                    className="min-h-[120px] resize-none bg-white/50 border-white/20 focus:border-primary/50 text-base p-4 rounded-2xl"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3">
                    <Button 
                      size="icon" 
                      className="h-8 w-8 rounded-lg bg-gradient-primary border-0"
                      onClick={handleGenerate}
                      disabled={!prompt}
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => setPrompt(chip)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-black/5 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors text-muted-foreground"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

      </div>
    </Layout>
  );
}
