import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Award, Edit, Trash2, Activity, Calendar, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate, getWeekStartInTimezone } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import StudentProfileCard from "@/components/StudentProfileCard";
import PersonalInformationCard from "@/components/PersonalInformationCard";
import { loadStripe } from "@stripe/stripe-js";
import ActivateStudentDialog from "@/components/ActivateStudentDialog";
import PaymentMethods from "@/components/PaymentMethods";
import PaymentHistory from "@/components/PaymentHistory";

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isFreezeDialogOpen, setIsFreezeDialogOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");

  useEffect(() => {
    const setupSuccess = searchParams.get("setup_success");
    const setupCancelled = searchParams.get("setup_cancelled");

    if (setupSuccess === "true") {
      toast.success("Payment method added successfully!");
      // Clear the query param
      setSearchParams({});
      // Invalidate payment methods query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["payment-methods", id] });
    } else if (setupCancelled === "true") {
      toast.info("Payment method setup cancelled.");
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, queryClient, id]);

  const createSetupSessionMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Student ID is missing");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-setup-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            studentId: id,
            organizationId: organization.id,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("create-setup-session failed", response.status, errorBody);
        let errorMessage = "An unexpected error occurred.";
        try {
          const jsonError = JSON.parse(errorBody);
          if (jsonError.error) {
            errorMessage = jsonError.error;
          }
        } catch (e) {
          errorMessage = errorBody.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      const { sessionId, stripeAccountId } = data;
      
      console.log("Initializing Stripe with:", {
        keyPrefix: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.substring(0, 8),
        stripeAccountId,
        sessionId
      });

      // When using Stripe Connect, we need to pass the connected account ID
      const stripe = await loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
      );
      if (stripe && sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error("Stripe redirect error:", error);
          toast.error(`Payment method setup redirect failed: ${error.message}`);
        }
      } else {
        console.error("Stripe initialization failed:", { stripe: !!stripe, sessionId });
        toast.error("Failed to initialize Stripe or missing session ID.");
      }
    },
    onError: (error) => {
      toast.error(`Failed to initiate payment method setup: ${error.message}`);
    },
  });

  const handleAddPaymentMethod = () => {
    createSetupSessionMutation.mutate();
  };

  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: ["student", id, organization?.id],
    enabled: !!id && !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, membership_plans(name, price, period)")
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: membershipPlans } = useQuery({
    queryKey: ["membershipPlans", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("price");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: attendanceHistory } = useQuery({
    queryKey: ["student-attendance", id, organization?.timezone, organization?.id],
    enabled: !!id && !!organization?.id,
    queryFn: async () => {
      const startOfWeek = getWeekStartInTimezone(organization?.timezone);
      const { data, error } = await supabase
        .from("attendance")
        .select("*, schedules(name, start_time)")
        .eq("organization_id", organization!.id)
        .eq("student_id", id)
        .gte("date", startOfWeek)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: totalClasses } = useQuery({
    queryKey: ["totalClasses", id, organization?.id],
    enabled: !!id && !!organization?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organization!.id)
        .eq("student_id", id);

      if (error) throw error;
      return count;
    },
  });

  const { data: paymentMethods, isLoading: isLoadingPaymentMethods, error: paymentMethodsError } = useQuery({
    queryKey: ["payment-methods", id],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-methods`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ studentId: id }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch payment methods:", response.status, errorText);
        throw new Error("Failed to fetch payment methods");
      }

      const data = await response.json();
      return data.paymentMethods || [];
    },
    enabled: !!id,
  });

  // Log payment methods error for debugging
  if (paymentMethodsError) {
    console.error("Payment methods query error:", paymentMethodsError);
  }

  useEffect(() => {
    if (student?.membership_plan_id) {
      setSelectedPlan(student.membership_plan_id.toString());
    }
  }, [student]);

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${
          import.meta.env.VITE_SUPABASE_URL
        }/functions/v1/delete-payment-method`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ paymentMethodId, studentId: id }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete payment method");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods", id] });
      toast.success("Payment method deleted successfully");
    },
    onError: (error) => {
      toast.error(`Error deleting payment method: ${error.message}`);
    },
  });

  const setDefaultPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${
          import.meta.env.VITE_SUPABASE_URL
        }/functions/v1/set-default-payment-method`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ paymentMethodId, studentId: id }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to set default payment method");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods", id] });
      toast.success("Default payment method updated successfully");
    },
    onError: (error) => {
      toast.error(`Error setting default payment method: ${error.message}`);
    },
  });

  const updateMembershipMutation = useMutation({
    mutationFn: async ({ planId, additionalUpdates }: { planId: string; additionalUpdates?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("students")
        .update({ membership_plan_id: parseInt(planId), ...additionalUpdates })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Membership plan selected. Redirecting to payment...");
      setIsDialogOpen(false);
      setPendingStatus(null);
    },
    onError: (error) => {
      toast.error(`Error updating membership: ${error.message}`);
    },
  });

  const createCheckoutSessionMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      if (!id) throw new Error("Student ID is missing");
      console.log("Creating checkout session:", { studentId: id, planId });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${
          import.meta.env.VITE_SUPABASE_URL
        }/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            studentId: id,
            planId,
            organizationId: organization.id,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("create-checkout-session failed", response.status, errorBody);
        let errorMessage = "An unexpected error occurred.";
        try {
          const jsonError = JSON.parse(errorBody);
          if (jsonError.error) {
            errorMessage = jsonError.error;
          }
        } catch (e) {
          errorMessage = errorBody.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      const { sessionId, stripeAccountId } = data;
      
      console.log("Initializing Stripe Checkout with:", {
        keyPrefix: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.substring(0, 8),
        stripeAccountId,
        sessionId
      });

      // When using Stripe Connect, we need to pass the connected account ID
      const stripe = await loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
      );
      if (stripe && sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error("Stripe redirect error:", error);
          toast.error(`Payment redirect failed: ${error.message}`);
        }
      } else {
        console.error("Stripe initialization failed:", { stripe: !!stripe, sessionId });
        toast.error("Failed to initialize Stripe or missing session ID.");
      }
    },
    onError: (error) => {
      toast.error(`Failed to create checkout session: ${error.message}`);
    },
  });

  const chargeStudentMutation = useMutation({
    mutationFn: async ({ planId, paymentMethodId, billingStartDate }: { planId: string; paymentMethodId: string; billingStartDate?: string }) => {
      if (!id) throw new Error("Student ID is missing");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/charge-student`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            studentId: id,
            planId,
            paymentMethodId,
            billingStartDate,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = "An unexpected error occurred.";
        try {
          const jsonError = JSON.parse(errorBody);
          if (jsonError.error) {
            errorMessage = jsonError.error;
          }
        } catch (e) {
          errorMessage = errorBody.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["student-payments", id] });
      toast.success("Membership activated successfully!");
      setIsDialogOpen(false);
      setPendingStatus(null);
      
      // Set status to active after successful payment
      updateStudentStatusMutation.mutate();
    },
    onError: (error) => {
      toast.error(`Failed to charge card: ${error.message}`);
    },
  });

  const handleUpdateMembership = (paymentMethodId?: string, billingStartDate?: string) => {
    if (!selectedPlan) {
      toast.error("Please select a membership plan.");
      return;
    }

    const plan = membershipPlans?.find(p => p.id.toString() === selectedPlan);
    if (!plan) {
      toast.error("Selected plan not found. Please try again.");
      return;
    }

    if (plan.price === "0" || plan.price === "0.00") {
      activateFreebieMutation.mutate(selectedPlan);
    } else if (paymentMethodId) {
      chargeStudentMutation.mutate({ planId: selectedPlan, paymentMethodId, billingStartDate });
    } else {
      createCheckoutSessionMutation.mutate({ planId: selectedPlan });
    }
  };

  const activateFreebieMutation = useMutation({
    mutationFn: async (planId: string) => {
      // Find the plan to determine if it's a trial plan
      const plan = membershipPlans?.find(p => p.id.toString() === planId);
      if (!plan) {
        throw new Error("Plan not found");
      }
      
      // Check if this is a trial plan (free with Daily or Weekly period)
      const isTrialPlan = 
        (plan.price === "0" || plan.price === "0.00") &&
        ["Daily", "Weekly"].includes(plan.period);
      
      const { error } = await supabase
        .from("students")
        .update({
          membership_plan_id: parseInt(planId),
          status: isTrialPlan ? 'trial' : 'student',
          membership_status: 'active'
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Free membership activated successfully!");
      setIsDialogOpen(false);
      setPendingStatus(null);
    },
    onError: (error) => {
      toast.error(`Error activating free membership: ${error.message}`);
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!id) throw new Error("Student ID is missing");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!organization?.id) {
        throw new Error("Organization ID is missing");
      }

      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          studentId: id,
          organizationId: organization.id,
          reason,
        },
      });

      if (error) {
        console.error("cancel-subscription failed", error);
        throw new Error(error.message || "Failed to cancel subscription");
      }

      return data;
    },
  });

  const freezeStudentMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      try {
        await cancelSubscriptionMutation.mutateAsync(`Account frozen: ${reason}`);
      } catch {
        // Ignore cancellation errors — subscription may not exist
      }
      const { error } = await supabase
        .from("students")
        .update({
          membership_status: "frozen",
          freeze_reason: reason,
          frozen_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      setIsFreezeDialogOpen(false);
      setFreezeReason("");
      toast.success("Account frozen successfully");
    },
    onError: (error) => {
      toast.error(`Error freezing account: ${error.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      let updates: Record<string, unknown> = {};
      
      if (newStatus === "trial") {
        updates = { status: "trial", membership_status: null, membership_plan_id: null };
      } else if (newStatus === "none") {
        updates = { status: "none", membership_status: null, membership_plan_id: null };
      } else if ((newStatus === "frozen" || newStatus === "inactive") && student?.status === "trial") {
        updates = { status: "none", membership_status: newStatus, membership_plan_id: null };
      } else if (newStatus === "frozen" || newStatus === "inactive") {
        // Cancel any active Stripe subscriptions immediately
        console.log(`Cancelling subscription for status change to: ${newStatus}`);
        try {
          const result = await cancelSubscriptionMutation.mutateAsync(
            `Student status changed to ${newStatus}`
          );
          console.log("Subscription cancellation result:", result);
        } catch (cancelError) {
          console.error("Error cancelling subscription:", cancelError);
          // Continue with status update even if cancellation fails
          // The subscription might not exist or already be cancelled
        }
        
        // Keep membership_plan_id so we know what plan to reactivate with
        // Only update the membership_status to frozen/inactive
        updates = {
          membership_status: newStatus
        };
      } else if (newStatus === "active") {
        // For active status from frozen/inactive, need to process payment
        // Always open the membership dialog to process payment
        // Pre-select their existing plan if they have one
        throw new Error("REDIRECT_TO_MEMBERSHIP_SELECTION");
      } else {
        throw new Error(`Invalid status for direct update: ${newStatus}`);
      }
      
      const { error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      // Check if this is our special redirect case
      if (error.message === "REDIRECT_TO_MEMBERSHIP_SELECTION") {
        setIsDialogOpen(true);
        return;
      }
      toast.error(`Error updating status: ${error.message}`);
    },
  });

  const updateProgressionMutation = useMutation({
    mutationFn: async (updates: { belt: BeltRank; stripes: number }) => {
      const { error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Progression updated successfully");
    },
    onError: (error) => {
      toast.error(`Error updating progression: ${error.message}`);
    },
  });

  const updateStudentStatusMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .update({
          status: "student",
          membership_status: "active"
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
    },
    onError: (error) => {
      console.error("Error updating student status:", error);
    },
  });

  if (isLoadingStudent) {
    return <div>Loading...</div>;
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Student not found</p>
          </CardContent>
        </Card>
  
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>

      {/* Student Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
              {student.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">{student.name || "Unknown Student"}</h2>
              {(() => {
                // Determine the current effective status
                const isActiveStudent = student.status === "student" && student.membership_status === "active";
                const isTrial = student.status === "trial";
                const isNone = student.status === "none" && student.membership_status !== "inactive" && student.membership_status !== "frozen";
                const isFrozen = student.membership_status === "frozen";
                const isInactive = student.membership_status === "inactive";
                
                // Determine display value for the select
                let displayValue = "none";
                if (isActiveStudent) displayValue = "active";
                else if (isTrial) displayValue = "trial";
                else if (isFrozen) displayValue = "frozen";
                else if (isInactive) displayValue = "inactive";
                else if (isNone) displayValue = "none";
                
                // Determine background color
                const bgClass = cn(
                  "h-8 w-[140px] border-none",
                  isActiveStudent && "bg-green-500 text-white hover:bg-green-600",
                  isTrial && "bg-blue-500 text-white hover:bg-blue-600",
                  isNone && "bg-gray-400 text-white hover:bg-gray-500",
                  isFrozen && "bg-yellow-500 text-white hover:bg-yellow-600",
                  isInactive && "bg-gray-500 text-white hover:bg-gray-600"
                );
                
                return (
                  <Select
                    value={displayValue}
                    onValueChange={(value) => {
                      if (value === "frozen") {
                        setIsFreezeDialogOpen(true);
                      } else {
                        updateStatusMutation.mutate(value);
                      }
                    }}
                    disabled={updateStatusMutation.isPending}
                  >
                    <SelectTrigger className={bgClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Status "none": Show only Trial and Active */}
                      {isNone && (
                        <>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </>
                      )}
                      {/* Status "trial": Show Active (upgrade) and Inactive (didn't sign up) */}
                      {isTrial && (
                        <>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </>
                      )}
                      {/* Status "active": Show only Frozen and Inactive (no going back to Trial) */}
                      {isActiveStudent && (
                        <>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </>
                      )}
                      {/* Status "frozen": Allow reactivation or going inactive */}
                      {isFrozen && (
                        <>
                          <SelectItem value="frozen">Frozen</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </>
                      )}
                      {/* Status "inactive": Allow reactivation or freezing */}
                      {isInactive && (
                        <>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <PersonalInformationCard student={student} timezone={organization?.timezone} />
          <StudentProfileCard
            student={{ ...student, stripes: student.stripes || 0 }}
            totalClasses={totalClasses || 0}
            classesThisWeek={attendanceHistory?.length || 0}
            onUpdate={updateProgressionMutation.mutateAsync}
          />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Membership Info
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsDialogOpen(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-0 pt-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-medium text-foreground">
                  {student.membership_plans?.name || "No Plan"}
                </span>
              </div>
              {student.membership_plans?.price && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-foreground">
                    ${student.membership_plans.price}/{student.membership_plans.period}
                  </span>
                </div>
              )}
              {student.billing_start_date && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Billing Start Date</span>
                  <span className="font-medium text-foreground">
                    {formatDate(student.billing_start_date, organization?.timezone)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Join Date</span>
                <span className="font-medium text-foreground">
                  {formatDate(student.join_date, organization?.timezone)}
                </span>
              </div>
              {student.membership_status === "frozen" && (
                <>
                  {student.frozen_at && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Snowflake className="h-3.5 w-3.5 text-blue-400" />
                        Frozen Since
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(student.frozen_at, organization?.timezone)}
                      </span>
                    </div>
                  )}
                  {student.freeze_reason && (
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Freeze Reason</span>
                      <span className="font-medium text-foreground capitalize">
                        {student.freeze_reason}
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                This Week's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendanceHistory?.map((record: { id: number; date: string; schedules?: { name: string; start_time: string } | null }) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {record.schedules?.name || "Class"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(record.date, organization?.timezone)}
                        {record.schedules?.start_time &&
                          ` • ${record.schedules.start_time.slice(0, 5)}`}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-500 flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Present
                    </span>
                  </div>
                ))}
                {attendanceHistory?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No attendance records for this week.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <PaymentMethods
            paymentMethods={paymentMethods || []}
            onAddPaymentMethod={handleAddPaymentMethod}
            onDeletePaymentMethod={deletePaymentMethodMutation.mutate}
            onSetDefaultPaymentMethod={setDefaultPaymentMethodMutation.mutate}
            isLoading={isLoadingPaymentMethods}
          />
          <PaymentHistory studentId={id!} />
        </div>
      </div>

      {/* Freeze Dialog */}
      <Dialog open={isFreezeDialogOpen} onOpenChange={(open) => { setIsFreezeDialogOpen(open); if (!open) setFreezeReason(""); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-blue-400" />
              Freeze Account
            </DialogTitle>
            <DialogDescription>
              Billing will be paused until you unfreeze the account. {student?.name} can still be manually checked in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for freeze</Label>
            <Textarea
              placeholder="e.g. Injured knee, traveling for 3 weeks, financial hardship..."
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFreezeDialogOpen(false); setFreezeReason(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => freezeStudentMutation.mutate({ reason: freezeReason })}
              disabled={!freezeReason.trim() || freezeStudentMutation.isPending}
            >
              {freezeStudentMutation.isPending ? "Freezing..." : "Freeze Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activation Dialog */}
      <ActivateStudentDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setPendingStatus(null);
        }}
        plans={membershipPlans || []}
        selectedPlanId={selectedPlan}
        onSelectPlan={setSelectedPlan}
        onProceedToPayment={(pmId, startDate) => handleUpdateMembership(pmId, startDate)}
        onActivateFreePlan={() => handleUpdateMembership()}
        isProcessing={createCheckoutSessionMutation.isPending || activateFreebieMutation.isPending || chargeStudentMutation.isPending}
        studentName={student.name || "Unknown Student"}
        studentStatus={student.status as "trial" | "student"}
        paymentMethods={paymentMethods || []}
      />
    </div>
  );
}
