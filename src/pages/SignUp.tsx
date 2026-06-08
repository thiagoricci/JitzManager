import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingEmail, setFetchingEmail] = useState(false);

  useEffect(() => {
    // Ensure we are signed out before starting the signup process
    // This prevents 406 errors if a previous session exists
    supabase.auth.signOut();

    if (!sessionId) {
      // Redirect to landing if trying to access signup directly without paying
      toast.error("Please subscribe to create an account.");
      navigate("/");
      return;
    }
    
    // Fetch email from session
    const fetchSessionEmail = async () => {
      setFetchingEmail(true);
      try {
        const { data, error } = await supabase.functions.invoke("complete-signup", {
          body: { sessionId, action: "get_session_details" },
        });

        if (error) throw error;
        if (data?.email) {
          setEmail(data.email);
        }
      } catch (error) {
        console.error("Error fetching session details:", error);
        toast.error("Could not retrieve payment details. Please try again.");
        navigate("/");
      } finally {
        setFetchingEmail(false);
      }
    };
    fetchSessionEmail();
  }, [sessionId, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId) {
      toast.error("Please subscribe to create an account.");
      navigate("/");
      return;
    }
    
    setLoading(true);

    try {
      // Paid flow: Complete signup via Edge Function
      const { data, error } = await supabase.functions.invoke("complete-signup", {
        body: { email, password, sessionId },
      });

      if (error) {
        // Check if it's the "User already exists" error
        // The error object from invoke might be wrapped
        const errorMessage = error.message || "";
        if (errorMessage.includes("User already exists")) {
          toast.error("Account already exists. Please login to complete setup.");
          navigate("/login");
          return;
        }
        throw error;
      }
      
      if (data?.error) throw new Error(data.error);

      // Auto-login after creation
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.success("Account created! Please login.");
        navigate("/login");
      } else {
        toast.success("Welcome! Let's set up your academy.");
        // Redirect to onboarding for first-time users to set up their gym
        navigate("/onboarding");
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error.message || "Error creating account");
    } finally {
      setLoading(false);
    }
  };

  // Don't render the form if there's no session ID (user will be redirected)
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Complete Registration
          </CardTitle>
          <CardDescription>
            Payment successful! Create your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!sessionId} // Disable if pre-filled from session
                className={sessionId ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus={!!sessionId}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}