import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function StripeConnectCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, refreshProfile } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "denied">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      // Check for OAuth error (user denied access)
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      
      if (error) {
        if (error === "access_denied") {
          setStatus("denied");
          setErrorMessage(errorDescription || "You denied access to your Stripe account");
        } else {
          setStatus("error");
          setErrorMessage(errorDescription || error);
        }
        return;
      }

      // Get the authorization code from OAuth callback
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        setStatus("error");
        setErrorMessage("No authorization code provided");
        return;
      }

      if (!session?.access_token) {
        setStatus("error");
        setErrorMessage("Not authenticated");
        return;
      }

      try {
        // Call the complete-stripe-connect function to exchange code for account
        // Note: redirect_uri is NOT required for the token exchange per Stripe OAuth docs
        const { data, error: invokeError } = await supabase.functions.invoke(
          "complete-stripe-connect",
          {
            body: { code, state },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to complete Stripe setup");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        // Success! Refresh the profile to get the updated organization
        await refreshProfile();
        setStatus("success");
        setBusinessName(data?.businessName || "");
        toast.success("Stripe account connected successfully!");
      } catch (err: unknown) {
        console.error("Error completing Stripe Connect:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    handleCallback();
  }, [searchParams, session, refreshProfile]);

  const handleRetryConnect = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }

    setStatus("loading");

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-stripe-connect-link",
        {
          body: {
            returnUrl: `${window.location.origin}/stripe-connect-callback`,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to create Stripe link");
      }

      // Redirect to Stripe OAuth
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Error retrying connect:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to Stripe");
    }
  };

  const handleGoToSettings = () => {
    navigate("/settings");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Connecting Stripe Account</CardTitle>
              <CardDescription>
                Please wait while we connect your Stripe account...
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-green-600">Stripe Connected!</CardTitle>
              <CardDescription>
                {businessName ? (
                  <>Your Stripe account "{businessName}" has been successfully connected.</>
                ) : (
                  <>Your Stripe account has been successfully connected.</>
                )}
                {" "}You can now accept payments from your students.
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <CardTitle className="text-red-600">Connection Failed</CardTitle>
              <CardDescription>
                {errorMessage || "There was an error connecting your Stripe account."}
              </CardDescription>
            </>
          )}

          {status === "denied" && (
            <>
              <div className="mx-auto mb-4">
                <AlertCircle className="h-12 w-12 text-yellow-500" />
              </div>
              <CardTitle className="text-yellow-600">Access Denied</CardTitle>
              <CardDescription>
                You chose not to connect your Stripe account. You can try again
                whenever you're ready.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {status === "success" && (
            <Button onClick={handleGoToSettings} className="w-full">
              Go to Settings
            </Button>
          )}

          {status === "error" && (
            <>
              <Button onClick={handleRetryConnect} className="w-full">
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={handleGoToSettings}
                className="w-full"
              >
                Back to Settings
              </Button>
            </>
          )}

          {status === "denied" && (
            <>
              <Button onClick={handleRetryConnect} className="w-full">
                Connect Stripe Account
              </Button>
              <Button
                variant="outline"
                onClick={handleGoToSettings}
                className="w-full"
              >
                Back to Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}