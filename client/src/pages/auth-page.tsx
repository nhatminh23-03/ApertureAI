import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, ChevronLeft } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { z } from "zod";

const registerSchema = insertUserSchema.extend({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm<Pick<InsertUser, "username" | "password">>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 hover:bg-transparent hover:text-primary"
          onClick={() => {
            // If coming from an internal redirect (history exists), go back.
            // Otherwise go home.
            if (window.history.length > 1) {
              window.history.back();
            } else {
              setLocation("/");
            }
          }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Left Column: Auth Forms */}
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-primary"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue editing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your password" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Choose a password" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.location.href = "/api/auth/google"}
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Google
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Hero Visual */}
      <div className="hidden lg:flex flex-col justify-center bg-muted p-10 text-white dark:text-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
        
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl font-bold mb-6">Unleash Your Creativity with AI</h1>
          <p className="text-lg text-zinc-300 mb-8">
            Transform your photos instantly using advanced AI filters and natural language editing. No design skills required.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 p-4 rounded-lg backdrop-blur-sm border border-zinc-700">
              <div className="text-2xl font-bold mb-1">AI Remix</div>
              <div className="text-sm text-zinc-400">Reimagine photos with generative AI</div>
            </div>
            <div className="bg-zinc-800/50 p-4 rounded-lg backdrop-blur-sm border border-zinc-700">
              <div className="text-2xl font-bold mb-1">Natural Edit</div>
              <div className="text-sm text-zinc-400">Edit using plain English commands</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
