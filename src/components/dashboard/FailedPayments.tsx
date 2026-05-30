import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, XCircle, RefreshCw, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface FailedPayment {
  id: number;
  student_id: number;
  amount: number;
  date: string;
  failure_reason: string | null;
  failure_code: string | null;
  retry_count: number;
  students: { name: string } | null;
}

const MAX_RETRIES = 5;

function classifyFailure(code: string | null): {
  label: string;
  needsCardUpdate: boolean;
  className: string;
} {
  if (!code) return { label: "Payment Failed", needsCardUpdate: false, className: "bg-red-100 text-red-800 border-red-200" };

  const insufficientFundsCodes = ["insufficient_funds", "withdrawal_count_limit_exceeded", "debit_insufficient_funds"];
  const cardUpdateCodes = ["expired_card", "authentication_required", "card_not_supported", "card_velocity_exceeded", "incorrect_cvc", "incorrect_number"];

  if (insufficientFundsCodes.includes(code)) {
    return { label: "Insufficient Funds", needsCardUpdate: false, className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  }
  if (cardUpdateCodes.includes(code) || code === "expired_card") {
    return { label: "Update Card", needsCardUpdate: true, className: "bg-orange-100 text-orange-800 border-orange-200" };
  }
  return { label: "Card Declined", needsCardUpdate: true, className: "bg-red-100 text-red-800 border-red-200" };
}

export default function FailedPayments() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: failedPayments } = useQuery({
    queryKey: ["failed-payments", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, student_id, amount, date, failure_reason, failure_code, retry_count, students(name)")
        .eq("organization_id", organization!.id)
        .eq("status", "failed")
        .order("date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as FailedPayment[];
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ paymentId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Retry failed");
      return result;
    },
    onSuccess: (_data, paymentId) => {
      queryClient.invalidateQueries({ queryKey: ["failed-payments", organization?.id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Payment collected successfully!");
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["failed-payments", organization?.id] });
      toast.error(`Retry failed: ${error.message}`);
    },
  });

  if (!failedPayments || failedPayments.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5" />
          Failed Payments ({failedPayments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {failedPayments.map((payment) => {
            const { label, needsCardUpdate, className } = classifyFailure(payment.failure_code);
            const attemptsLeft = MAX_RETRIES - payment.retry_count;
            const maxReached = payment.retry_count >= MAX_RETRIES;
            const isRetrying = retryMutation.isPending && retryMutation.variables === payment.id;

            return (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-red-200 bg-white p-4 gap-3"
              >
                {/* Left: icon + name + date */}
                <div
                  className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/student/${payment.student_id}`)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {payment.students?.name || "Unknown Student"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payment.date, organization?.timezone)}
                    </p>
                  </div>
                </div>

                {/* Middle: failure badge + retry count + reason tooltip */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border text-xs ${className}`}>
                    {needsCardUpdate ? <CreditCard className="h-3 w-3 mr-1" /> : null}
                    {label}
                  </Badge>

                  {payment.failure_reason && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="hidden sm:block text-xs text-muted-foreground max-w-[140px] truncate cursor-help">
                            {payment.failure_reason}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{payment.failure_reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  <Badge variant="destructive" className="shrink-0">
                    ${Number(payment.amount).toFixed(2)}
                  </Badge>

                  <span className={`text-xs shrink-0 ${maxReached ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {payment.retry_count}/{MAX_RETRIES}
                  </span>
                </div>

                {/* Right: retry button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={needsCardUpdate ? "outline" : "default"}
                        className="shrink-0"
                        disabled={maxReached || isRetrying || retryMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          retryMutation.mutate(payment.id);
                        }}
                      >
                        <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""} ${!needsCardUpdate ? "mr-1" : ""}`} />
                        {!needsCardUpdate && (isRetrying ? "Retrying..." : `Retry`)}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {maxReached
                        ? "Maximum retries reached. Ask the student to update their card."
                        : needsCardUpdate
                        ? "Student needs to update their card before retrying."
                        : `Retry charge (${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left)`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
