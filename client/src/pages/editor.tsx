import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, Undo2, Wand2, Pencil, Sparkles, Zap, Wand, Sun, Contrast, Palette, Volume2, Filter, Lightbulb, Flame, Cloud, Heart, Film } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Edit } from "@shared/schema";
import { reducer, useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";

export default function Editor() {
  const [location, setLocation] = useLocation();
  const search = new URLSearchParams(window.location.search);
  const id = search.get("id");
  const fromHistory = search.get("fromHistory") === "1";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState<"prompt" | "processing" | "preview">("prompt");
  const [editMode, setEditMode] = useState<"ai" | "reallife">("reallife");
  const [prompt, setPrompt] = useState("");
  // Natural Edit defaults to 50%, AI Edit defaults to 100%
  const [intensity, setIntensity] = useState([50]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [refineFromCurrent, setRefineFromCurrent] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiNaturalSuggestions, setAiNaturalSuggestions] = useState<
    Array<{ label: string; params: any }>
  >([]);
  // Original suggestions from the database (for the original image)
  const [originalSuggestions, setOriginalSuggestions] = useState<{ 
    natural: Array<{ label: string; params: any }>; 
    ai: string[] 
  }>({ natural: [], ai: [] });
  // Current suggestions (for the current edited image, fetched via generateAISuggestions)
  const [currentSuggestions, setCurrentSuggestions] = useState<{ 
    natural: Array<{ label: string; params: any }>; 
    ai: string[] 
  }>({ natural: [], ai: [] });
  // Active suggestions displayed in the UI (switches based on refineFromCurrent toggle)
  const activeSuggestions = refineFromCurrent ? currentSuggestions : originalSuggestions;
  const [baseNaturalParams, setBaseNaturalParams] = useState<any | null>(null);
  const [selectedNaturalSuggestions, setSelectedNaturalSuggestions] = useState<Set<string>>(new Set());
  const [previousImageId, setPreviousImageId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [activeNaturalAction, setActiveNaturalAction] = useState<"auto" | "manual" | null>(null);

  const hasUserAdjustedIntensity = useRef(false);
  const lastTriggeredStrength = useRef<number | null>(null);
  const lastImageIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Reset initialization when ID changes
  useEffect(() => {
    initializedRef.current = false;
  }, [id]);

  const { data: edit, isLoading } = useQuery<Edit>({
    queryKey: [`/api/edits/${id}`],
    enabled: !!id
  });

  useEffect(() => {
    if (edit) {
      if (!isEditingTitle && edit.title) {
        setTitle(edit.title || "Untitled Draft");
      }
      
      // Only run initialization logic once per edit load
      if (!initializedRef.current) {
        initializedRef.current = true;

        // Extract original suggestions with params from the response (for the original image)
        // The backend returns naturalSuggestionsWithParams if available
        if ((edit as any).naturalSuggestionsWithParams) {
          const natural = (edit as any).naturalSuggestionsWithParams;
          const ai = edit.suggestions ? edit.suggestions.slice(5, 10) : [];
          setOriginalSuggestions({ natural, ai });
        } else if (edit.suggestions && edit.suggestions.length > 0) {
          // Fallback: just use labels
          const natural = edit.suggestions.slice(0, 5).map(label => ({ label, params: {} }));
          const ai = edit.suggestions.slice(5, 10);
          setOriginalSuggestions({ natural, ai });
        }
        
        // Restore from sessionStorage if available, unless we explicitly came from History
        const cachedState = fromHistory ? null : sessionStorage.getItem(`edit-${id}`);
        if (cachedState) {
          try {
            const parsed = JSON.parse(cachedState);
            if (parsed.step !== undefined) setStep(parsed.step);
            if (parsed.prompt !== undefined) setPrompt(parsed.prompt);
            if (parsed.intensity !== undefined) setIntensity([parsed.intensity]);
            if (parsed.refineFromCurrent !== undefined) setRefineFromCurrent(parsed.refineFromCurrent);
            if (parsed.baseNaturalParams !== undefined) setBaseNaturalParams(parsed.baseNaturalParams);
            if (parsed.aiSuggestions !== undefined) setAiSuggestions(parsed.aiSuggestions);
            if (parsed.aiNaturalSuggestions !== undefined) setAiNaturalSuggestions(parsed.aiNaturalSuggestions);
            if (parsed.currentSuggestions !== undefined) setCurrentSuggestions(parsed.currentSuggestions);
          } catch (e) {
            console.error("Failed to restore state", e);
          }
        } else if (edit.status === "completed") {
          // When opening a completed edit fresh (including from History), start on the full editor panel
          // with Natural/AI tabs and the Refine Current Edit toggle enabled.
          setStep("prompt");
          setPrompt(edit.prompt);
          setRefineFromCurrent(true);
          // Load AI suggestions so the panel is ready as soon as user generates again
          generateAISuggestions();
        }
      }

      // Track previous image ID for before/after slider when refining from current edit
      if (!lastImageIdRef.current) {
        // First load: treat original as the initial baseline
        setPreviousImageId(edit.originalImageId);
        lastImageIdRef.current = edit.currentImageId;
      } else if (lastImageIdRef.current !== edit.currentImageId) {
        // Image changed: remember last image as the "before" when refining from current
        setPreviousImageId(lastImageIdRef.current);
        lastImageIdRef.current = edit.currentImageId;
      }
    }
  }, [edit, id, fromHistory, isEditingTitle]);

  // Persist state to sessionStorage
  useEffect(() => {
    if (id) {
      sessionStorage.setItem(`edit-${id}`, JSON.stringify({
        step,
        prompt,
        intensity: intensity[0],
        refineFromCurrent,
        baseNaturalParams,
        aiSuggestions,
        aiNaturalSuggestions,
        currentSuggestions
      }));
    }
  }, [step, prompt, intensity, refineFromCurrent, id, baseNaturalParams, aiSuggestions, aiNaturalSuggestions, currentSuggestions]);

  // Debounced effect strength regeneration when the user adjusts the slider
  // For AI Edit: regenerate image with new strength
  // For Natural Edit: re-apply last Natural Edit params with scaled strength (no extra AI)
  useEffect(() => {
    // Only run when the user has actually moved the intensity slider
    if (!hasUserAdjustedIntensity.current) return;

    if (!edit || step !== "preview") return;

    const currentStrength = intensity[0];
    const lastStrength = lastTriggeredStrength.current;
    
    // Only trigger if strength changed by 5% or more (minimum threshold to reduce sensitivity)
    if (lastStrength !== null && Math.abs(currentStrength - lastStrength) < 5) {
      return;
    }

    const timer = setTimeout(() => {
      // Check threshold again before triggering (in case user made small adjustment)
      const finalStrength = intensity[0];
      if (lastTriggeredStrength.current !== null && Math.abs(finalStrength - lastTriggeredStrength.current) < 5) {
        return;
      }
      
      lastTriggeredStrength.current = finalStrength;
      
      if (editMode === "ai" && prompt) {
        // AI Edit mode: trigger regeneration with new effect strength
        setIsRegenerating(true);
        generateMutation.mutate({ clearCache: false });
      } else if (editMode === "reallife" && baseNaturalParams) {
        // Natural Edit mode: reuse last base params and scale by new strength
        console.log("[NaturalEdit Slider] Strength changed to:", finalStrength + "%");

        const strengthFactor = finalStrength / 50;
        const scaledParams = {
          brightness: Math.round((baseNaturalParams.brightness || 0) * strengthFactor),
          contrast: Math.round((baseNaturalParams.contrast || 0) * strengthFactor),
          saturation: Math.round((baseNaturalParams.saturation || 0) * strengthFactor),
          hue: Math.round((baseNaturalParams.hue || 0) * strengthFactor),
          sharpen: Math.round((baseNaturalParams.sharpen || 0) * strengthFactor * 10) / 10,
          noise: Math.round((baseNaturalParams.noise || 0) * strengthFactor)
        };

        console.log("[NaturalEdit Slider] Strength factor:", strengthFactor);
        console.log("[NaturalEdit Slider] Base params:", baseNaturalParams);
        console.log("[NaturalEdit Slider] Scaled params:", scaledParams);

        naturalEditMutation.mutate({
          params: scaledParams,
          suggestionLabel: Array.from(selectedNaturalSuggestions).join(", ") || (prompt ? `Natural edit: ${prompt}` : "Natural edit"),
          source: "slider",
          refineFromCurrent,
          strengthPercent: finalStrength,
        });
      }
    }, 800); // 800ms debounce for less sensitive slider

    return () => {
      clearTimeout(timer);
    };
  }, [intensity, edit, step, editMode, selectedNaturalSuggestions, activeSuggestions]);

  type NaturalEditVariables = {
    params?: any;
    suggestionLabel?: string;
    prompt?: string;
    selectedLabels?: string[];
    source?: "slider" | "button";
    refineFromCurrent?: boolean;
    strengthPercent?: number;
  };

  const naturalEditMutation = useMutation<any, Error, NaturalEditVariables>({
    // Supports either direct Sharp params or a prompt that will be analyzed into params server-side
    mutationFn: async ({ source, ...payload }: NaturalEditVariables) => {
      const res = await apiRequest("POST", `/api/natural-edit/${id}`, payload);
      return await res.json();
    },
    onMutate: (variables) => {
      // Show loading immediately when mutation starts (not when it succeeds)
      if (variables.source === "slider" || step === "preview") {
        setIsRegenerating(true);
      } else {
        setStep("processing");
      }
    },
    onSuccess: (data: any, variables) => {
      
      // Cache base params from response when available (for slider reuse),
      // but only for full Natural Edit runs (not for slider-only rescaling).
      if (variables?.source !== "slider" && data && data.params) {
        setBaseNaturalParams(data.params);
      }

      // For full Natural Edit runs (button / prompt), also analyze current edit for AI suggestions
      if (variables?.source !== "slider") {
        generateAISuggestions();
      }

      // Poll for completion (reduce churn on server)
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/edits/${id}`);
          const data = await res.json();
          
          if (data.status === "completed") {
            clearInterval(interval);
            if (step !== "preview") {
              setStep("preview");
            } else {
              setIsRegenerating(false);
            }
            queryClient.invalidateQueries({ queryKey: [`/api/edits/${id}`] });
          } else if (data.status === "failed") {
            clearInterval(interval);
            if (step !== "preview") {
              setStep("prompt");
            } else {
              setIsRegenerating(false);
            }
            toast({
              title: "Edit failed",
              description: "Failed to apply natural edit",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply natural edit",
        variant: "destructive"
      });
    }
  });

  // Reset active natural action when mutation settles
  useEffect(() => {
    if (!naturalEditMutation.isPending) {
      setActiveNaturalAction(null);
    }
  }, [naturalEditMutation.isPending]);

  const generateMutation = useMutation({
    mutationFn: async (options?: { clearCache?: boolean }) => {
      await apiRequest("POST", `/api/generate/${id}`, { 
        prompt,
        refineFromCurrent,
        effectStrength: intensity[0],
        clearCache: options?.clearCache
      });
    },
    onMutate: () => {
      // Show loading immediately when mutation starts
      if (!isRegenerating) {
        setStep("processing");
      } else {
        setIsRegenerating(true);
      }
    },
    onSuccess: () => {
      // Poll for completion with reduced frequency to avoid overwhelming small servers
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/edits/${id}`);
          const data = await res.json();
          
          if (data.status === "completed") {
            clearInterval(interval);
            // Immediately hide loading and show preview
            setIsRegenerating(false);
            setStep("preview");
            // Invalidate query to refresh image
            queryClient.invalidateQueries({ queryKey: [`/api/edits/${id}`] });
            
            // Generate AI suggestions after completion (only on first generation)
            if (!aiSuggestions.length) {
              generateAISuggestions();
            }
          } else if (data.status === "failed") {
            clearInterval(interval);
            setIsRegenerating(false);
            setStep("prompt");
            toast({
              title: "Generation failed",
              description: "The AI could not process your request. Please try again.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 1500);
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
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/suggestions/${id}`);
      if (response.ok) {
        const data = await response.json();
        const aiList: string[] = data.aiSuggestions || data.suggestions || [];
        const naturalList: Array<{ label: string; params: any }> =
          data.naturalSuggestions || [];

        setAiSuggestions(aiList);
        setAiNaturalSuggestions(naturalList);
        
        // Also update currentSuggestions so the prompt panel shows these when refineFromCurrent is ON
        setCurrentSuggestions({ natural: naturalList, ai: aiList });
      } else {
        // Fallback to generic AI Remix ideas only
        const fallback = [
          "Enhance lighting and contrast",
          "Add subtle background blur",
          "Apply vintage film effect",
          "Increase color saturation",
          "Add dramatic vignette",
        ];
        setAiSuggestions(fallback);
        setAiNaturalSuggestions([]);
      }
    } catch (error) {
      // Fallback to generic AI Remix ideas if API fails
      const fallback = [
        "Enhance lighting and contrast",
        "Add subtle background blur",
        "Apply vintage film effect",
        "Increase color saturation",
        "Add dramatic vignette",
      ];
      setAiSuggestions(fallback);
      setAiNaturalSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Unified handler for the magic button / Ctrl+Enter
  const handleGenerateClick = () => {
    const trimmedPrompt = prompt.trim();
    const hasPrompt = trimmedPrompt.length > 0;
    const hasSelected = selectedNaturalSuggestions.size > 0;

    if (editMode === "reallife") {
      setActiveNaturalAction("manual");
      
      // Case 1: only "Recommended for this image" chips selected, no freeform text
      if (!hasPrompt && hasSelected) {
        const mergedParams = {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          hue: 0,
          sharpen: 0,
          noise: 0
        };

        activeSuggestions.natural.forEach((suggestion: { label: string; params: any }) => {
          if (selectedNaturalSuggestions.has(suggestion.label)) {
            mergedParams.brightness += suggestion.params.brightness || 0;
            mergedParams.contrast += suggestion.params.contrast || 0;
            mergedParams.saturation += suggestion.params.saturation || 0;
            mergedParams.hue += suggestion.params.hue || 0;
            mergedParams.sharpen += suggestion.params.sharpen || 0;
            mergedParams.noise += suggestion.params.noise || 0;
          }
        });

        const strengthFactor = intensity[0] / 50;
        const scaledParams = {
          brightness: Math.round(mergedParams.brightness * strengthFactor),
          contrast: Math.round(mergedParams.contrast * strengthFactor),
          saturation: Math.round(mergedParams.saturation * strengthFactor),
          hue: Math.round(mergedParams.hue * strengthFactor),
          sharpen: Math.round(mergedParams.sharpen * strengthFactor * 10) / 10,
          noise: Math.round(mergedParams.noise * strengthFactor)
        };

        naturalEditMutation.mutate({
          params: scaledParams,
          suggestionLabel: Array.from(selectedNaturalSuggestions).join(", "),
          source: "button",
          refineFromCurrent,
          strengthPercent: intensity[0],
        });
        return;
      }

      // Case 2: user typed in textbox and/or used Quick Adjustments
      if (hasPrompt) {
        const selectedLabels = Array.from(selectedNaturalSuggestions);
        naturalEditMutation.mutate({
          prompt: trimmedPrompt,
          selectedLabels,
          suggestionLabel: selectedLabels.length ? selectedLabels.join(", ") : trimmedPrompt,
          source: "button",
          refineFromCurrent,
          strengthPercent: intensity[0],
        });
        return;
      }

      // Nothing to do in Natural Edit without prompt or selections
      return;
    }

    // AI Remix mode - only run if there's a prompt
    if (!hasPrompt) return;
    generateMutation.mutate({ clearCache: true });
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setStep("prompt")}
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            {editMode === "ai" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-full"
                onClick={() => generateMutation.mutate({ clearCache: true })}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Regenerate</span>
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2 rounded-full bg-gradient-primary border-0 shadow-lg shadow-primary/20"
              onClick={() => {
                if (user) {
                  setLocation("/history");
                } else if (id) {
                  sessionStorage.setItem("pending_edit_id", id);
                  toast({
                    title: "Log in to Save",
                    description: "Please log in to save your edits to your history.",
                  });
                  setLocation("/auth");
                }
              }}
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Save & Finish</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-6 auto-rows-max lg:auto-rows-auto">
        
        {/* Left Panel: Image Preview */}
        <div className="lg:col-span-8 h-auto lg:h-full relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black/5 dark:bg-white/5 min-h-[300px] md:min-h-[400px]">
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
              beforeImage={`/api/data/${
                refineFromCurrent && previousImageId
                  ? previousImageId
                  : edit.originalImageId
              }.png`}
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
        <div className="lg:col-span-4 flex flex-col gap-4 h-auto lg:h-full">
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
                    <span className="text-primary" data-testid="text-intensity-value">{intensity[0]}%</span>
                  </div>
                  <Slider 
                    value={intensity} 
                    onValueChange={(value) => {
                      hasUserAdjustedIntensity.current = true;
                      setIntensity(value);
                    }} 
                    max={100} 
                    step={1} 
                    className="cursor-pointer"
                    data-testid="slider-intensity"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editMode === "reallife" ? (
                      <>
                        {intensity[0] === 50 && "Default strength (50%)"}
                        {intensity[0] < 50 && "Subtle adjustments"}
                        {intensity[0] > 50 && intensity[0] < 100 && "Enhanced adjustments"}
                        {intensity[0] === 100 && "Maximum strength (100%)"}
                      </>
                    ) : (
                      <>
                        {intensity[0] === 0 && "Showing original image"}
                        {intensity[0] > 0 && intensity[0] < 100 && "Blending original and edited"}
                        {intensity[0] === 100 && "Showing full edited version"}
                      </>
                    )}
                  </p>
                </div>
                
                {editMode === "reallife" && baseNaturalParams ? (
                  (() => {
                    const factor = intensity[0] / 50;
                    const scaled = {
                      brightness: Math.round((baseNaturalParams.brightness || 0) * factor),
                      contrast: Math.round((baseNaturalParams.contrast || 0) * factor),
                      saturation: Math.round((baseNaturalParams.saturation || 0) * factor),
                      hue: Math.round((baseNaturalParams.hue || 0) * factor),
                      sharpen: Math.round((baseNaturalParams.sharpen || 0) * factor * 10) / 10,
                      noise: Math.round((baseNaturalParams.noise || 0) * factor),
                    };

                    const rows: Array<{ label: string; value: string }> = [];
                    const fmt = (v: number, suffix = "") =>
                      v > 0 ? `+${v}${suffix}` : v < 0 ? `${v}${suffix}` : `0${suffix}`;

                    if (scaled.brightness !== 0) rows.push({ label: "Brightness", value: fmt(scaled.brightness, "%") });
                    if (scaled.contrast !== 0) rows.push({ label: "Contrast", value: fmt(scaled.contrast, "%") });
                    if (scaled.saturation !== 0) rows.push({ label: "Saturation", value: fmt(scaled.saturation, "%") });
                    if (scaled.hue !== 0) rows.push({ label: "Hue shift", value: fmt(scaled.hue, "°") });
                    if (scaled.sharpen !== 0) rows.push({ label: "Sharpness", value: fmt(scaled.sharpen) });
                    if (scaled.noise !== 0) rows.push({ label: "Noise reduction", value: fmt(scaled.noise, "%") });

                    return (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/5 to-sky-500/5 border border-white/10 text-xs text-muted-foreground space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground/80">Enhanced adjustments</span>
                          <span className="text-[10px] text-muted-foreground">
                            Based on {intensity[0]}% strength
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {rows.length === 0 ? (
                            <span className="col-span-2 text-[11px] text-muted-foreground/80">
                              No visible adjustments applied at this strength.
                            </span>
                          ) : (
                            rows.map((row, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-background/60 px-2 py-1 border border-white/5"
                              >
                                <span className="text-[11px] text-foreground/80">{row.label}</span>
                                <span className="text-[11px] font-medium text-primary">{row.value}</span>
                              </div>
                            ))
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/80">
                          Derived from your Natural Edit prompt and image analysis.
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4 rounded-xl bg-muted/50 border border-white/10 text-sm text-muted-foreground">
                    <p>
                      AI applied: <span className="text-foreground font-medium">"{prompt}"</span>
                    </p>
                  </div>
                )}

                {/* AI Suggestions Section */}
                {(isLoadingSuggestions || aiSuggestions.length > 0 || aiNaturalSuggestions.length > 0) && (
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className={`w-4 h-4 text-primary ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                      <span>AI Suggestions</span>
                    </div>
                    
                    {isLoadingSuggestions ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Analyzing your image...
                        </p>
                        <div className="space-y-2">
                          {/* Skeleton loaders */}
                          {[1, 2, 3].map((i) => (
                            <div 
                              key={i} 
                              className="h-6 rounded-lg bg-white/30 dark:bg-black/30 animate-pulse"
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {aiNaturalSuggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                              Natural Edit ideas
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aiNaturalSuggestions.map((suggestion, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setEditMode("reallife");
                                    setPrompt(suggestion.label);
                                    setRefineFromCurrent(true);
                                    setStep("prompt");
                                    setSelectedNaturalSuggestions(new Set()); // Clear previous selections
                                    promptInputRef.current?.focus();
                                  }}
                                  className="px-3 py-1.5 text-xs rounded-full bg-white/80 dark:bg-black/40 border border-primary/20 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  {suggestion.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {aiSuggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                              AI Remix ideas
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aiSuggestions.map((suggestion, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setEditMode("ai");
                                    setPrompt(suggestion);
                                    setRefineFromCurrent(true);
                                    setStep("prompt");
                                    setSelectedNaturalSuggestions(new Set()); // Clear previous selections
                                    promptInputRef.current?.focus();
                                  }}
                                  className="px-3 py-1.5 text-xs rounded-full bg-white/80 dark:bg-black/40 border border-primary/20 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                                  data-testid={`button-suggestion-${i}`}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  className="w-full gap-2" 
                  variant="outline"
                  onClick={() => {
                    // Determine file extension based on original image format
                    // Default to jpg if not specified, but preserve original format
                    const originalMimeType = (edit as any).originalMimeType || "image/jpeg";
                    let ext = "jpg";
                    if (originalMimeType === "image/png") ext = "png";
                    else if (originalMimeType === "image/webp") ext = "webp";
                    else if (originalMimeType === "image/jpeg") ext = "jpg";
                    
                    const link = document.createElement("a");
                    link.href = `/api/data/${edit.currentImageId}.${ext}`;
                    link.download = `aperture-edit-${id}.${ext}`;
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
              // Modern Tab Interface
              <div className="flex flex-col gap-4 h-full">
                {/* Tab Navigation - Centered Pill Style */}
                <div className="flex justify-center">
                  <div 
                    role="tablist"
                    className="inline-flex gap-1 p-1.5 bg-white/10 dark:bg-black/20 rounded-full border border-white/20 shadow-lg"
                  >
                    {[
                      { id: "reallife", label: "Natural Edit", icon: Filter },
                      { id: "ai", label: "AI Remix", icon: Sparkles }
                    ].map((tab, idx) => {
                      const IconComponent = tab.icon;
                      const isActive = editMode === tab.id;
                      return (
                        <motion.button
                          key={tab.id}
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={`tabpanel-${tab.id}`}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => setEditMode(tab.id as "reallife" | "ai")}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                              e.preventDefault();
                              const tabs = ["reallife", "ai"];
                              const currentIdx = tabs.indexOf(editMode);
                              const nextIdx = e.key === "ArrowLeft" 
                                ? (currentIdx - 1 + tabs.length) % tabs.length
                                : (currentIdx + 1) % tabs.length;
                              setEditMode(tabs[nextIdx] as "reallife" | "ai");
                            } else if (e.key === "Home") {
                              e.preventDefault();
                              setEditMode("reallife");
                            } else if (e.key === "End") {
                              e.preventDefault();
                              setEditMode("ai");
                            }
                          }}
                          className="relative px-4 py-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-white/10"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Animated background */}
                          {isActive && (
                            <motion.div
                              layoutId="activeTabPill"
                              className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full shadow-md"
                              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                            />
                          )}
                          
                          {/* Tab content */}
                          <div className="relative flex items-center gap-2">
                            <IconComponent className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-foreground"}`}>
                              {tab.label}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content with Smooth Transitions */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={editMode}
                    id={`tabpanel-${editMode}`}
                    role="tabpanel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, type: "spring", bounce: 0.2 }}
                    className="flex flex-col gap-4 flex-1"
                  >
                    {/* Descriptor */}
                    <p className="text-sm text-muted-foreground">
                      {editMode === "reallife"
                        ? "Edit in real life for natural, photography-style adjustments."
                        : "Transform with AI for creative, generative edits."}
                    </p>

                    {/* Prompt Input */}
                    <div className="relative">
                      <Textarea
                        ref={promptInputRef}
                        placeholder={editMode === "reallife" 
                          ? "e.g. add brightness, increase contrast..." 
                          : "e.g. golden hour relight, cinematic grade..."}
                        className="bg-white/50 border-white/20 focus:border-primary/50 text-base p-3 rounded-xl resize-none min-h-[80px]"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            handleGenerateClick();
                          }
                        }}
                        data-testid="input-prompt"
                      />
                      <div className="absolute right-2 bottom-2">
                        <Button 
                          size="icon" 
                          className="h-8 w-8 rounded-lg bg-gradient-primary border-0"
                          onClick={handleGenerateClick}
                          disabled={(editMode === "reallife" && selectedNaturalSuggestions.size === 0 && !prompt) || (editMode === "ai" && !prompt) || generateMutation.isPending || naturalEditMutation.isPending}
                          data-testid="button-generate"
                        >
                          <Wand2 className={`w-4 h-4 ${(generateMutation.isPending || naturalEditMutation.isPending) ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    {/* Suggestions from image analysis (switches based on refineFromCurrent toggle) */}
                    {(activeSuggestions.natural.length > 0 || activeSuggestions.ai.length > 0 || (refineFromCurrent && isLoadingSuggestions)) && (
                      <div className="space-y-4 pt-2">
                        {/* Loading state for suggestions when refineFromCurrent is ON */}
                        {refineFromCurrent && isLoadingSuggestions && editMode === "reallife" && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary animate-spin" />
                              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Analyzing image...</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div 
                                  key={i} 
                                  className="h-7 w-24 rounded-full bg-white/30 dark:bg-black/30 animate-pulse"
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                        
                        {/* Natural Edit Suggestions - Multi-select (click to toggle) */}
                        {activeSuggestions.natural.length > 0 && editMode === "reallife" && !isLoadingSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20"
                          >
                            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">✨ Recommended for this image</p>
                            
                            {/* Auto Enhance Button */}
                            {activeSuggestions.natural.find(s => s.label === "Auto Enhance") && (
                              <div className="mb-3">
                                <Button
                                  className="w-full relative group overflow-hidden border-0 bg-gradient-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                                  onClick={() => {
                                    const autoSuggestion = activeSuggestions.natural.find(s => s.label === "Auto Enhance");
                                    if (autoSuggestion) {
                                      setActiveNaturalAction("auto");
                                      setSelectedNaturalSuggestions(new Set([autoSuggestion.label]));
                                      naturalEditMutation.mutate({
                                        suggestionLabel: autoSuggestion.label,
                                        params: autoSuggestion.params,
                                        refineFromCurrent
                                      });
                                    }
                                  }}
                                  disabled={naturalEditMutation.isPending}
                                >
                                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                  <Sparkles className={`w-4 h-4 mr-2 ${naturalEditMutation.isPending && activeNaturalAction === "auto" ? 'animate-spin' : ''}`} />
                                  <span className="font-semibold tracking-wide">Auto Enhance</span>
                                </Button>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {activeSuggestions.natural
                                .filter(s => s.label !== "Auto Enhance")
                                .map((suggestion, i) => (
                                <motion.button
                                  key={i}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const newSelected = new Set(selectedNaturalSuggestions);
                                    if (selectedNaturalSuggestions.has(suggestion.label)) {
                                      newSelected.delete(suggestion.label);
                                    } else {
                                      newSelected.add(suggestion.label);
                                    }
                                    setSelectedNaturalSuggestions(newSelected);
                                  }}
                                  className={`px-3 py-1.5 text-xs rounded-full transition-all group focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                    selectedNaturalSuggestions.has(suggestion.label)
                                      ? "bg-primary/40 border border-primary/70 text-primary-foreground font-semibold shadow-md shadow-primary/30"
                                      : "bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20 text-foreground/90"
                                  }`}
                                >
                                  {selectedNaturalSuggestions.has(suggestion.label) && "✓ "}{suggestion.label}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Loading state for AI Remix suggestions when refineFromCurrent is ON */}
                        {refineFromCurrent && isLoadingSuggestions && editMode === "ai" && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary animate-spin" />
                              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Analyzing image...</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div 
                                  key={i} 
                                  className="h-7 w-28 rounded-full bg-white/30 dark:bg-black/30 animate-pulse"
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* AI Remix Suggestions (strings) */}
                        {activeSuggestions.ai.length > 0 && editMode === "ai" && !isLoadingSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20"
                          >
                            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">✨ Recommended for this image</p>
                            <div className="flex flex-wrap gap-2">
                              {activeSuggestions.ai.map((suggestion, i) => (
                                <motion.button
                                  key={i}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    // For AI Remix, ensure we're in AI mode and use the suggestion as the full prompt
                                    setEditMode("ai");
                                    setPrompt(suggestion);
                                    promptInputRef.current?.focus();
                                  }}
                                  className="px-3 py-1.5 text-xs rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20 transition-all group focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  {suggestion}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Suggestion Chips */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {editMode === "reallife" ? "Quick Adjustments" : "Creative Ideas"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {editMode === "reallife" ? (
                          // Natural Edit Quick Adjustments – append to textbox with commas
                          [
                            { label: "add brightness", icon: Sun },
                            { label: "increase contrast", icon: Contrast },
                            { label: "balance color", icon: Palette },
                            { label: "reduce noise", icon: Contrast},
                            { label: "sharpen slightly", icon: Zap }
                          ].map((suggestion, i) => {
                            const IconComponent = suggestion.icon;
                            return (
                              <motion.button
                                key={i}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setPrompt((prev) => {
                                    if (!prev) return suggestion.label;
                                    const lower = prev.toLowerCase();
                                    if (lower.includes(suggestion.label.toLowerCase())) return prev;
                                    const trimmed = prev.trim().replace(/,+\s*$/, "");
                                    return `${trimmed}, ${suggestion.label}`;
                                  });
                                  promptInputRef.current?.focus();
                                }}
                                className="px-3 py-1.5 text-xs rounded-full bg-white/80 dark:bg-black/40 border border-white/30 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1.5 group focus:outline-none focus:ring-2 focus:ring-primary/50"
                                data-testid={`button-suggestion-${i}`}
                              >
                                <IconComponent className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                {suggestion.label}
                              </motion.button>
                            );
                          })
                        ) : (
                          // AI Remix suggestions with icons and glow
                          [
                            { label: "golden hour relight", icon: Lightbulb },
                            { label: "cinematic teal–orange", icon: Film },
                            { label: "dramatic sky", icon: Cloud },
                            { label: "soft portrait glow", icon: Heart },
                            { label: "moody film look", icon: Flame }
                          ].map((suggestion, i) => {
                            const IconComponent = suggestion.icon;
                            return (
                              <motion.button
                                key={i}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setEditMode("ai");
                                  setPrompt(suggestion.label);
                                  promptInputRef.current?.focus();
                                }}
                                className="px-3 py-1.5 text-xs rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-1.5 group focus:outline-none focus:ring-2 focus:ring-primary/50"
                                data-testid={`button-suggestion-${i}`}
                              >
                                <IconComponent className="w-3 h-3 text-primary group-hover:scale-110 transition-transform" />
                                {suggestion.label}
                              </motion.button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Regenerate Mode Toggle */}
                {edit.status === "completed" && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-white/10 mt-auto">
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-xs font-medium">Refine Current Edit</span>
                      <span className="text-xs text-muted-foreground">
                        {refineFromCurrent ? "Uses edited image" : "Uses original image"}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <Switch 
                        checked={refineFromCurrent}
                        onCheckedChange={(checked) => {
                          setRefineFromCurrent(checked);
                          // Clear selected suggestions when toggling since the suggestions will change
                          setSelectedNaturalSuggestions(new Set());
                        }}
                        data-testid="switch-refine-mode"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>

      </div>
    </Layout>
  );
}
