import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Edit, Trash2, Activity, Calendar } from "lucide-react";
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
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate, getWeekStartInTimezone } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import StudentProfileCard from "@/components/StudentProfileCard";
import PersonalInformationCard from "@/components/PersonalInformationCard";
import { loadStripe } from "@stripe/stripe-js";
import ActivateStudentDialog from "@/components/ActivateStudentDialog";

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, membership_plans(name)")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: membershipPlans } = useQuery({
    queryKey: ["membershipPlans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .order("price");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: attendanceHistory } = useQuery({
    queryKey: ["student-attendance", id, organization?.timezone],
    queryFn: async () => {
      const startOfWeek = getWeekStartInTimezone(organization?.timezone);
      const { data, error } = await supabase
        .from("attendance")
        .select("*, schedules(name, start_time)")
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
    queryKey: ["totalClasses", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("student_id", id);

      if (error) throw error;
      return count;
    },
  });

  useEffect(() => {
    if (student?.membership_plan_id) {
      setSelectedPlan(student.membership_plan_id.toString());
    }
  }, [student]);

  const updateMembershipMutation = useMutation({
    mutationFn: async ({ planId, additionalUpdates }: { planId: string; additionalUpdates?: any }) => {
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
    mutationFn: async (planId: string) => {
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
      const { sessionId } = data;
      const stripe = await loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      );
      if (stripe && sessionId) {
        await stripe.redirectToCheckout({ sessionId });
      } else {
        toast.error("Failed to initialize Stripe or missing session ID.");
      }
    },
    onError: (error) => {
      toast.error(`Failed to create checkout session: ${error.message}`);
    },
  });

  const handleUpdateMembership = () => {
    if (selectedPlan) {
      createCheckoutSessionMutation.mutate(selectedPlan);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      let updates: any = {};
      // Only handle non-active status changes here
      // 'active' status is handled by the payment verification flow
      if (newStatus === "trial") {
        updates = { status: "trial", membership_status: null, membership_plan_id: null };
      } else if (newStatus === "frozen" || newStatus === "inactive") {
        updates = { membership_status: newStatus };
        // Optionally, clear the plan ID when setting to inactive/frozen, depending on business logic
        // For now, let's keep the plan ID so reactivation is easier if needed outside the payment flow
        // updates.membership_plan_id = null;
      } else {
        // This case should ideally not be reached if the Select is configured correctly
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

  const deleteStudentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted successfully");
      navigate("/students");
    },
    onError: (error) => {
      toast.error(`Error deleting student: ${error.message}`);
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
  
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the student
                and remove their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteStudentMutation.mutate()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Student
          </Button>
          <Link to={`/student/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </Link>
        </div>
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
              {student.status === "trial" ? (
                // If the student is a trial, changing status to active should open the membership dialog to select a plan and initiate payment
                <Select
                  value="trial"
                  onValueChange={(value) => {
                    if (value === "active") {
                      // If they try to set to active, open the membership dialog
                      setIsDialogOpen(true);
                    } else {
                      // For other status changes from trial (e.g., inactive), update directly
                      updateStatusMutation.mutate(value);
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 w-[140px] border-none bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Activate (requires payment)</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                // If the student is already a 'student' (not trial), manage membership status directly, except for 'active'
                <Select
                  value={student.membership_status || "active"}
                  onValueChange={(value) => {
                    if (value === "active") {
                      // If the student is already a 'student' but not 'active', and they select 'active',
                      // they might not have a plan. We need to ensure a plan is selected or prompt for payment if none exists.
                      // For now, if they are not active but are a student, we assume they need to pay again or re-activate via payment.
                      // A more complex flow might involve checking if their plan is expired vs. frozen/inactive.
                      // For simplicity here, if they are 'student' and not 'active', we'll force a plan selection/payment.
                      if (!student.membership_plan_id) {
                        // If they don't have a plan, open the dialog to select one
                        setIsDialogOpen(true);
                      } else {
                        // If they have a plan, we could potentially just update the status, but per requirement,
                        // activation must be tied to a confirmed payment. So, we'll also force a new payment flow here.
                        // Or, we could have a different "Reactivate" button/flow that just updates status if a plan exists.
                        // For now, let's enforce payment on 'active' status selection.
                        setIsDialogOpen(true);
                      }
                    } else {
                      // Update status directly for inactive/frozen
                      updateStatusMutation.mutate(value);
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 w-[140px] border-none",
                      student.membership_status === "active" && "bg-green-500 text-white hover:bg-green-60",
                      student.membership_status === "inactive" && "bg-gray-500 text-white hover:bg-gray-600",
                      student.membership_status === "frozen" && "bg-yellow-500 text-white hover:bg-yellow-600"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activate (requires payment)</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-medium text-foreground">
                  {student.membership_plans?.name || "No Plan"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Join Date</span>
                <span className="font-medium text-foreground">
                  {formatDate(student.join_date, organization?.timezone)}
                </span>
              </div>
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
                {attendanceHistory?.map((record: any) => (
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
        </div>
      </div>

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
        onProceedToPayment={handleUpdateMembership}
        isProcessing={createCheckoutSessionMutation.isPending}
        studentName={student.name || "Unknown Student"}
      />
    </div>
  );
}
