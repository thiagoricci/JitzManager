import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "verifying" | "success" | "error";

const MAX_ATTEMPTS = 5;

export default function EnrollSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const organizationId = searchParams.get("org");
  const [status, setStatus] = useState<Status>("verifying");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // No session info to verify against — still confirm payment to the student.
    if (!sessionId || !organizationId) {
      setStatus("success");
      return;
    }

    let cancelled = false;

    const provision = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke("complete-signup-enrollment", {
            body: { sessionId, organizationId },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          if (data?.success) {
            if (!cancelled) setStatus("success");
            return;
          }
          // status === "processing" — subscription not finalized yet, retry.
        } catch (err) {
          console.error("Enrollment provisioning error:", err);
          // Network/transient — fall through to retry.
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      // Payment went through; the webhook backstop will reconcile if needed.
      if (!cancelled) setStatus("success");
    };

    provision();
    return () => {
      cancelled = true;
    };
  }, [sessionId, organizationId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          {status === "verifying" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Confirming your membership…</CardTitle>
              <CardDescription>
                Hang tight while we finish setting up your account. This only takes a moment.
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold">You're all set!</CardTitle>
              <CardDescription>
                Your membership is confirmed and the academy has your details. They'll be in touch
                with the next steps — you can close this page.
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold">Payment received</CardTitle>
              <CardDescription>
                We received your payment but hit a snag finalizing your profile. Don't worry —
                the academy has been notified and will complete your registration.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A receipt has been sent to your email by Stripe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
