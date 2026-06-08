import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const sessionId = searchParams.get("session_id");
  const studentId = searchParams.get("student_id");
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'error' | 'timeout'>('verifying');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const verifyPaymentMutation = useMutation({
    mutationFn: async (params: { sessionId: string; studentId: string }) => {
      const { data, error } = await supabase.functions.invoke("verify-payment-and-update-student", {
        body: params,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        console.error("Verification error:", error);
        throw new Error(error.message || "Verification failed");
      }

      // Handle processing status
      if (data?.status === "processing") {
        const processingError = new Error("Payment is still processing");
        processingError.message = data.message || "Payment is still processing. Please wait a moment and try again.";
        throw processingError;
      }

      return data;
    },
    onSuccess: (data) => {
      setVerificationStatus('success');
      toast.success("Payment successful and student updated!");
      // Redirect to the student detail page to see the successful activation
      setTimeout(() => {
        navigate(`/student/${studentId}`);
      }, 2000);
    },
    onError: (error, variables, context) => {
      console.error("Payment verification failed:", error);
      setVerificationStatus('error');
      
      // If we haven't exceeded max retries and it's a processing error, retry
      if (retryCount < maxRetries && (
        error.message?.includes('processing') || 
        error.message?.includes('not successful') ||
        error.message?.includes('Payment status')
      )) {
        toast.info(`Payment may still be processing. Retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          verifyPaymentMutation.mutate(variables);
        }, 3000); // Wait 3 seconds before retry
        return;
      }
      
      toast.error(`Error verifying payment: ${error.message}`);
      // Still navigate to student detail after error to avoid being stuck
      setTimeout(() => {
        navigate(`/student/${studentId}`);
      }, 3000);
    },
  });

  // Add timeout mechanism
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (verificationStatus === 'verifying') {
        setVerificationStatus('timeout');
        toast.warning("Payment verification timed out. Please check your student status manually.");
        setTimeout(() => {
          navigate(`/student/${studentId}`);
        }, 3000);
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [verificationStatus, navigate]);

  useEffect(() => {
    if (sessionId && studentId && verificationStatus === 'verifying') {
      verifyPaymentMutation.mutate({ sessionId, studentId });
    }
  }, [sessionId, studentId, verificationStatus]);

  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary" />
            <h1 className="mt-4 text-2xl font-bold">Verifying Payment...</h1>
            <p className="text-muted-foreground text-center">
              Please wait while we confirm your payment.
              {retryCount > 0 && ` (Attempt ${retryCount + 1}/${maxRetries + 1})`}
            </p>
            <Button 
              variant="outline" 
              onClick={() => setVerificationStatus('timeout')}
              className="mt-4"
            >
              Skip Verification
            </Button>
          </>
        );
      
      case 'success':
        return (
          <>
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-green-600">Payment Successful!</h1>
            <p className="text-muted-foreground text-center">
              Your payment has been verified and the student has been updated.
              <br />
              Redirecting to student details...
            </p>
          </>
        );
      
      case 'error':
        return (
          <>
            <XCircle className="w-16 h-16 text-red-500" />
            <h1 className="mt-4 text-2xl font-bold text-red-600">Verification Failed</h1>
            <p className="text-muted-foreground text-center mb-4">
              We couldn't verify your payment automatically.
              <br />
              Please check the student's status manually or contact support.
            </p>
            <Button onClick={() => navigate(`/student/${studentId}`)} className="mt-4">
              View Student
            </Button>
          </>
        );
      
      case 'timeout':
        return (
          <>
            <Clock className="w-16 h-16 text-yellow-500" />
            <h1 className="mt-4 text-2xl font-bold text-yellow-600">Verification Timeout</h1>
            <p className="text-muted-foreground text-center mb-4">
              The verification is taking longer than expected.
              <br />
              Please check the student's status manually.
            </p>
            <Button onClick={() => navigate(`/student/${studentId}`)} className="mt-4">
              View Student
            </Button>
          </>
        );
      
      default:
        return null;
    }
  };

  if (!sessionId || !studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <XCircle className="w-16 h-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-red-600">Missing Information</h1>
        <p className="text-muted-foreground text-center mb-4">
          Payment session information is missing.
        </p>
        <Button onClick={() => navigate("/students")} className="mt-4">
          Go to Students
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      {renderContent()}
    </div>
  );
}