import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Seo } from "@/lib/seo";
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
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (hasProcessedRef.current) return;

      // Stripe sends error=access_denied if the user cancels
      const error = searchParams.get("error");
      if (error) {
        hasProcessedRef.current = true;
        setStatus(error === "access_denied" ? "denied" : "error");
        setErrorMessage(searchParams.get("error_description") || error);
        return;
      }

      // Standard OAuth flow — Stripe returns a one-time authorization code
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        hasProcessedRef.current = true;
        setStatus("error");
        setErrorMessage("No authorization code received from Stripe.");
        return;
      }

      hasProcessedRef.current = true;

      if (!session?.access_token) {
        setStatus("error");
        setErrorMessage("Not authenticated");
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "exchange-stripe-code",
          {
            body: { code, state },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (invokeError) {
          let message = invokeError.message || "Failed to connect Stripe account";
          try {
            const body = await (invokeError as { context?: Response }).context?.json?.();
            if (body?.error) message = body.error;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        await refreshProfile(true);
        setStatus("success");
        toast.success("Stripe account connected successfully!");
      } catch (err) {
        console.error("Error connecting Stripe:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to connect Stripe account");
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.access_token]);

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
          body: { returnUrl: `${window.location.origin}/stripe-connect-callback` },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to create Stripe link");
      }
      window.location.href = data.url;
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to Stripe");
    }
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
              <CardDescription>Please wait…</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-green-600">Stripe Connected!</CardTitle>
              <CardDescription>
                Your Stripe account has been connected. You can now collect payments from students.
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
                You chose not to connect your Stripe account. You can try again whenever you're ready.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {status === "success" && (
            <Button onClick={() => navigate("/settings")} className="w-full">
              Go to Settings
            </Button>
          )}
          {(status === "error" || status === "denied") && (
            <>
              <Button onClick={handleRetryConnect} className="w-full">
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate("/settings")} className="w-full">
                Back to Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
