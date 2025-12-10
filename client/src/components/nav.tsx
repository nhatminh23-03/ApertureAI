import { Link, useLocation } from "wouter";
import { Aperture, History, Sparkles, User, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { Edit } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function Nav() {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Find the most recent draft edit
  const { data: edits } = useQuery<Edit[]>({
    queryKey: ["/api/history"],
    staleTime: 10000 // Cache for 10 seconds
  });
  
  const lastDraft = edits?.find(e => e.status === "pending");
  const editorHref = lastDraft ? `/editor?id=${lastDraft.id}` : "/";
  
  // Check if user logged in with Google (has googleId)
  const isGoogleUser = user?.googleId != null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const updates: any = {};
      if (newUsername.trim()) updates.username = newUsername.trim();
      if (newPassword.trim()) {
        updates.currentPassword = currentPassword;
        updates.newPassword = newPassword;
      }
      
      if (Object.keys(updates).length === 0) {
        toast({ title: "No changes", description: "Please enter new values to update." });
        setIsUpdating(false);
        return;
      }
      
      await apiRequest("PATCH", "/api/user", updates);
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." });
      setShowSettings(false);
      setNewUsername("");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
      toast({ 
        title: "Update failed", 
        description: error.message || "Failed to update profile.", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/50 backdrop-blur-md dark:bg-black/20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform">
              <Aperture className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">Aperture AI</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link href={editorHref} className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              location.startsWith("/editor") 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
            )}>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Editor</span>
            </Link>
            <Link href="/history" className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              location === "/history" 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
            )}>
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
            
            {/* User Profile Dropdown */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="ml-2 h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20"
                  >
                    <User className="w-4 h-4 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {isGoogleUser ? "Signed in with Google" : "Local account"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isGoogleUser && (
                    <DropdownMenuItem onClick={() => setShowSettings(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Account Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-red-500 focus:text-red-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button 
                  size="sm" 
                  className="ml-2 rounded-full bg-gradient-primary shadow-md hover:shadow-primary/25 border-0 text-white font-medium px-6"
                >
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Account Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="w-[95vw] max-w-[425px] sm:w-full">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
            <DialogDescription>
              Update your username or password. Leave fields empty to keep current values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">New Username</Label>
              <Input
                id="username"
                placeholder={user?.username}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
