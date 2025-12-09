import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Editor from "@/pages/editor";
import History from "@/pages/history";
import AuthPage from "@/pages/auth-page";
import { useEffect } from "react";
import { ToastAction } from "@/components/ui/toast";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to auth but save the attempted location?
    // For now, just simplistic redirect
    setLocation("/auth");
    return null;
  }

  return <Component {...rest} />;
}

function ClaimPendingEdit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      const pendingEditId = sessionStorage.getItem("pending_edit_id");
      if (pendingEditId) {
        const claimEdit = async () => {
          try {
            await apiRequest("POST", `/api/edits/${pendingEditId}/claim`);
            sessionStorage.removeItem("pending_edit_id");
            
            // Immediately invalidate history cache so it refreshes instantly
            queryClient.invalidateQueries({ queryKey: ["/api/history"] });
            
            toast({
              title: "Edit Saved",
              description: "The draft has been added to your history.",
            });
            // Redirect to history to show it's done
            setLocation("/history");
          } catch (error) {
            console.error("Failed to claim edit", error);
            toast({
              title: "Error",
              description: "Failed to save your pending edit.",
              variant: "destructive",
            });
          }
        };

        // Ask the user instead of auto-claiming
        toast({
          title: "Unsaved Draft Found",
          description: "We found an unsaved edit from this session. Save it to your account?",
          action: (
            <ToastAction altText="Save" onClick={claimEdit}>
              Save
            </ToastAction>
          ),
          duration: 8000,
        });
      }
    }
  }, [user, toast, setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={Home} />
      <Route path="/editor" component={Editor} />
      <Route path="/history">
        <ProtectedRoute component={History} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ClaimPendingEdit />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
