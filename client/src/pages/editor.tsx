import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, Undo2, Wand2, Pencil, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Edit } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

export default function Editor() {
  const [location] = useLocation();
  const search = new URLSearchParams(window.location.search);
  const id = search.get("id");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<"prompt" | "processing" | "preview">("prompt");
  const [prompt, setPrompt] = useState("");
  const [intensity, setIntensity] = useState([100]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [refineFromCurrent, setRefineFromCurrent] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: edit, isLoading } = useQuery<Edit>({
    queryKey: [`/api/edits/${id}`],
    enabled: !!id
  });

  useEffect(() => {
    if (edit) {
      setTitle(edit.title || "Untitled Draft");
      
      // Restore from sessionStorage if available
      const cachedState = sessionStorage.getItem(`edit-${id}`);
      if (cachedState) {
        try {
          const parsed = JSON.parse(cachedState);
          if (parsed.step !== undefined) setStep(parsed.step);
          if (parsed.prompt !== undefined) setPrompt(parsed.prompt);
          if (parsed.intensity !== undefined) setIntensity([parsed.intensity]);
          if (parsed.refineFromCurrent !== undefined) setRefineFromCurrent(parsed.refineFromCurrent);
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      } else if (edit.status === "completed") {
        setStep("preview");
        setPrompt(edit.prompt);
        // Default to refining from current edit when opening a completed edit
        setRefineFromCurrent(true);
        // Load AI suggestions on initial load of completed edit
        generateAISuggestions();
      }
    }
  }, [edit, id]);

  // Persist state to sessionStorage
  useEffect(() => {
    if (id) {
      sessionStorage.setItem(`edit-${id}`, JSON.stringify({
        step,
        prompt,
        intensity: intensity[0],
        refineFromCurrent
      }));
    }
  }, [step, prompt, intensity, refineFromCurrent, id]);

  // Debounced effect strength regeneration
  useEffect(() => {
    if (!edit || step !== "preview" || !prompt) return;
    
    const timer = setTimeout(() => {
      // Trigger regeneration with new effect strength
      setIsRegenerating(true);
      generateMutation.mutate();
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [intensity]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/generate/${id}`, { 
        prompt,
        refineFromCurrent,
        effectStrength: intensity[0]
      });
    },
    onSuccess: () => {
      if (!isRegenerating) {
        setStep("processing");
      }
      // Poll for completion
      const interval = setInterval(async () => {
        const res = await fetch(`/api/edits/${id}`);
        const data = await res.json();
        
        if (data.status === "completed") {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: [`/api/edits/${id}`] });
          setStep("preview");
          setIsRegenerating(false);
          
          // Generate AI suggestions after completion (only on first generation)
          if (!aiSuggestions.length) {
            generateAISuggestions();
          }
        } else if (data.status === "failed") {
          clearInterval(interval);
          setStep("prompt");
          setIsRegenerating(false);
          toast({
            title: "Generation failed",
            description: "The AI could not process your request. Please try again.",
            variant: "destructive"
          });
        }
      }, 2000);
    },
    onError: () => {
       setIsRegenerating(false);
       toast({
         title: "Generation failed",
         description: "Something went wrong. Please try again.",
         variant: "destructive"
       });
    }
  });

  const generateAISuggestions = async () => {
    try {
      const response = await fetch(`/api/suggestions/${id}`);
      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
      } else {
        // Fallback to generic suggestions
        setAiSuggestions([
          "Enhance lighting and contrast",
          "Add subtle background blur",
          "Apply vintage film effect",
          "Increase color saturation",
          "Add dramatic vignette"
        ]);
      }
    } catch (error) {
      // Fallback to generic suggestions if API fails
      setAiSuggestions([
        "Enhance lighting and contrast",
        "Add subtle background blur",
        "Apply vintage film effect",
        "Increase color saturation",
        "Add dramatic vignette"
      ]);
    }
  };

  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      if (!newTitle.trim()) throw new Error("Title cannot be empty");
      await apiRequest("PATCH", `/api/edits/${id}`, { title: newTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/edits/${id}`] });
      setIsEditingTitle(false);
      toast({ title: "Title updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Update failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  if (isLoading) {
    return (
      <Layout fullWidth className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Layout>
    );
  }

  if (!edit) {
    return (
      <Layout>
        <div className="text-center pt-20">
          <h1 className="text-2xl font-bold">Image not found</h1>
          <Link href="/">
            <a className="text-primary hover:underline mt-4 inline-block">Go Home</a>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth className="h-[calc(100vh-6rem)] flex flex-col">
      
      {/* Top Bar - Contextual Actions */}
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          
          {/* Title Editor */}
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  updateTitleMutation.mutate(title);
                }}
                className="flex items-center gap-2"
              >
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                  onBlur={() => updateTitleMutation.mutate(title)}
                />
              </form>
            ) : (
              <button 
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2 text-sm font-medium hover:bg-black/5 p-1.5 px-3 rounded-lg transition-colors"
              >
                {title}
                <Pencil className="w-3 h-3 opacity-50" />
              </button>
            )}
          </div>
        </div>
        
        {step === "preview" && (
           <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setStep("prompt")}>
               <Undo2 className="w-4 h-4" />
               Undo
             </Button>
             <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => generateMutation.mutate()}>
               <RefreshCw className="w-4 h-4" />
               Regenerate
             </Button>
             <Link href="/history">
               <Button size="sm" className="gap-2 rounded-full bg-gradient-primary border-0 shadow-lg shadow-primary/20">
                 <Check className="w-4 h-4" />
                 Save & Finish
               </Button>
             </Link>
           </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-6">
        
        {/* Left Panel: Image Preview */}
        <div className="lg:col-span-8 h-full relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black/5 dark:bg-white/5">
          <AnimatePresence mode="wait">
            {(step === "processing" || isRegenerating) ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50 text-white"
              >
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium animate-pulse">
                  {isRegenerating ? "Adjusting effect strength..." : "Magic is happening..."}
                </p>
                <p className="text-sm text-white/50 mt-2">
                  {isRegenerating ? "Regenerating with new strength..." : "Generating new version with AI..."}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {step === "preview" ? (
            <BeforeAfterSlider
              beforeImage={`/api/data/${refineFromCurrent ? edit.currentImageId : edit.originalImageId}.png`}
              afterImage={`/api/data/${edit.currentImageId}.png`}
              intensity={100}
              className="h-full w-full"
            />
          ) : (
            <div className="h-full w-full relative flex items-center justify-center bg-black/90">
              <img src={`/api/data/${refineFromCurrent && edit.status === "completed" ? edit.currentImageId : edit.originalImageId}.png`} className="w-full h-full object-contain max-h-[80vh]" alt="Preview" data-testid="image-preview" />
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
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Effect Strength</span>
                    <span className="text-primary" data-testid="text-intensity-value">{intensity}%</span>
                  </div>
                  <Slider 
                    value={intensity} 
                    onValueChange={setIntensity} 
                    max={100} 
                    step={1} 
                    className="cursor-pointer"
                    data-testid="slider-intensity"
                  />
                  <p className="text-xs text-muted-foreground">
                    {intensity[0] === 0 && "Showing original image"}
                    {intensity[0] > 0 && intensity[0] < 100 && "Blending original and edited"}
                    {intensity[0] === 100 && "Showing full edited version"}
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-muted/50 border border-white/10 text-sm text-muted-foreground">
                  <p>AI applied: <span className="text-foreground font-medium">"{prompt}"</span></p>
                </div>

                {/* AI Suggestions Section */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>AI Suggestions</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Apply these enhancements to refine your edit further
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setPrompt(suggestion);
                            setRefineFromCurrent(true);
                            setStep("prompt");
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg bg-white/80 dark:bg-black/40 border border-primary/20 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                          data-testid={`button-suggestion-${i}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full gap-2" 
                  variant="outline"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `/api/data/${edit.currentImageId}.png`;
                    link.download = `aperture-edit-${id}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4" /> Download
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
                    data-testid="input-prompt"
                  />
                  <div className="absolute bottom-3 right-3">
                    <Button 
                      size="icon" 
                      className="h-8 w-8 rounded-lg bg-gradient-primary border-0"
                      onClick={() => generateMutation.mutate()}
                      disabled={!prompt || generateMutation.isPending}
                      data-testid="button-generate"
                    >
                      <Wand2 className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* Regenerate Mode Toggle */}
                {edit.status === "completed" && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-white/10">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium">Refine Current Edit</span>
                      <span className="text-xs text-muted-foreground">
                        {refineFromCurrent ? "Uses edited image" : "Uses original image"}
                      </span>
                    </div>
                    <Switch 
                      checked={refineFromCurrent}
                      onCheckedChange={setRefineFromCurrent}
                      data-testid="switch-refine-mode"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {edit.suggestions && edit.suggestions.length > 0 ? (
                      edit.suggestions.map((chip, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(chip)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-white border border-black/5 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors text-muted-foreground text-left"
                          data-testid={`button-initial-suggestion-${i}`}
                        >
                          {chip}
                        </button>
                      ))
                    ) : (
                       <p className="text-xs text-muted-foreground italic">No suggestions available</p>
                    )}
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
