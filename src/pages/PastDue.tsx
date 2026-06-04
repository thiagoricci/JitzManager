import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, DollarSign, RefreshCw, RotateCw, Users, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// Mirror of MAX_RETRIES in supabase/functions/retry-payment/index.ts. Once a
// payment hits this many attempts it can no longer be retried from here.
const MAX_RETRIES = 5;

interface FailedPayment {
  id: number;
  student_id: number | null;
  amount: number;
  date: string;
  status: string;
  failure_reason: string | null;
  failure_code: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string | null;
  students: { id: number; name: string | null } | null;
}

export default function PastDue() {
  const { organization, session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["past-due-payments", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, student_id, amount, date, status, failure_reason, failure_code, retry_count, next_retry_at, created_at, students(id, name)"
        )
        .eq("organization_id", organization!.id)
        .eq("status", "failed")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as unknown as FailedPayment[];
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (payment: FailedPayment) => {
      if (!session?.access_token) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("retry-payment", {
        body: { paymentId: payment.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        // Edge function returns the failure detail in the response body even on
        // a non-2xx status; surface that when available.
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: (payment) => setRetryingId(payment.id),
    onSettled: () => setRetryingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["past-due-payments"] });
      queryClient.invalidateQueries({ queryKey: ["student-payments"] });
      toast.success("Payment retried successfully.");
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["past-due-payments"] });
      toast.error(`Retry failed: ${error.message}`);
    },
  });

  const totalOutstanding =
    payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const affectedStudents = new Set(
    payments?.map((p) => p.student_id).filter((id): id is number => id != null)
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Past Due</h2>
        <p className="text-muted-foreground">
          Overdue and failed payments across all students. Retry a charge against
          the saved payment method.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Outstanding"
          value={`$${totalOutstanding.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard title="Failed Payments" value={payments?.length ?? 0} icon={AlertCircle} />
        <StatCard title="Affected Students" value={affectedStudents} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Past-Due Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading past-due payments...</div>
          ) : payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Failure Reason</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const exhausted = payment.retry_count >= MAX_RETRIES;
                  const isRetrying = retryingId === payment.id;
                  return (
                    <TableRow key={payment.id} className="bg-red-50/40">
                      <TableCell>
                        {payment.student_id ? (
                          <button
                            className="font-medium text-primary hover:underline"
                            onClick={() => navigate(`/student/${payment.student_id}`)}
                          >
                            {payment.students?.name ?? "Unknown student"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">Unknown student</span>
                        )}
                      </TableCell>
                      <TableCell>${Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>{formatDate(payment.date, organization?.timezone)}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <span className="text-sm text-muted-foreground block truncate">
                          {payment.failure_reason || "Payment failed"}
                        </span>
                        {payment.failure_code && (
                          <span className="text-xs text-muted-foreground/70">
                            {payment.failure_code}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {exhausted ? (
                          <Badge variant="destructive">Max retries reached</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {payment.retry_count} / {MAX_RETRIES}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exhausted || isRetrying}
                          onClick={() => retryMutation.mutate(payment)}
                        >
                          {isRetrying ? (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {isRetrying ? "Retrying..." : "Retry now"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">All caught up</p>
                <p className="text-sm text-muted-foreground">
                  No overdue or failed payments right now.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
