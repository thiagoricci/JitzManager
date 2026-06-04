import { useState } from "react";
import { Plus, Users, DollarSign, TrendingUp, Pencil, Trash2, Eye, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MembershipDialog, MembershipFormValues } from "@/components/MembershipDialog";
import { SignupLinkDialog } from "@/components/SignupLinkDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
import { useNavigate } from "react-router-dom";
import { MembershipPlanWithCounts } from "@/types/membership";
import { formatMoney, formatPeriod, formatPrice, isFreePrice, toAmount } from "@/lib/money";

export default function Memberships() {
  const queryClient = useQueryClient();
  const { profile, organization, session, can } = useAuth();
  const canManageBilling = can("manage_billing");
  const navigate = useNavigate();

  const syncToStripe = (planId: number, action: "create" | "update" | "delete") => {
    if (!session?.access_token) return;
    supabase.functions.invoke("sync-membership-plan", {
      body: { planId, action },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch((err) => console.error("Stripe sync error:", err));
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanWithCounts | null>(null);
  const [planToDelete, setPlanToDelete] = useState<MembershipPlanWithCounts | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPlanName, setLinkPlanName] = useState<string | undefined>(undefined);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const handleGenerateLink = (plan: MembershipPlanWithCounts) => {
    if (!organization?.id) {
      toast.error("Organization not found");
      return;
    }
    setLinkPlanName(plan.name);
    setLinkUrl(`${window.location.origin}/join/${organization.id}/${plan.id}`);
    setLinkDialogOpen(true);
  };

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
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

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("membership_plan_id, status, membership_status")
        .eq("organization_id", organization!.id);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: MembershipFormValues) => {
      if (!profile?.organization_id) throw new Error("Organization not found");
      const formattedData = {
        ...values,
        features: values.features?.map((f) => f.value) || [],
        organization_id: profile.organization_id,
      };
      const { data, error } = await supabase.from("membership_plans").insert(formattedData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["membershipPlans"] });
      toast.success("Membership plan created successfully");
      setIsDialogOpen(false);
      syncToStripe(data.id, "create");
    },
    onError: (error) => {
      toast.error(`Error creating plan: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: MembershipFormValues) => {
      const formattedData = {
        ...values,
        features: values.features?.map((f) => f.value) || [],
      };
      const { error } = await supabase
        .from("membership_plans")
        .update(formattedData)
        .eq("id", selectedPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipPlans"] });
      toast.success("Membership plan updated successfully");
      setIsDialogOpen(false);
      syncToStripe(selectedPlan.id, "update");
      setSelectedPlan(null);
    },
    onError: (error) => {
      toast.error(`Error updating plan: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("membership_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipPlans"] });
      toast.success("Membership plan deleted successfully");
      setPlanToDelete(null);
    },
    onError: (error) => {
      if (error.message.includes("violates foreign key constraint")) {
        toast.error("Cannot delete plan: There are students assigned to this plan.");
      } else {
        toast.error(`Error deleting plan: ${error.message}`);
      }
    },
  });

  const handleAddPlan = () => {
    setSelectedPlan(null);
    setIsDialogOpen(true);
  };

  const handleEditPlan = (plan: MembershipPlanWithCounts) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const handleDeletePlan = (plan: MembershipPlanWithCounts) => {
    setPlanToDelete(plan);
  };

  const confirmDelete = async () => {
    if (!planToDelete) return;
    // Archive in Stripe first while plan still exists in DB
    if (planToDelete.stripe_product_id && session?.access_token) {
      await supabase.functions.invoke("sync-membership-plan", {
        body: { planId: planToDelete.id, action: "delete" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch((err) => console.error("Stripe archive error:", err));
    }
    deleteMutation.mutate(planToDelete.id);
  };

  const handleSubmit = (values: MembershipFormValues) => {
    if (selectedPlan) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  if (isLoadingPlans || isLoadingStudents) {
    return <div>Loading...</div>;
  }

  // Calculate stats
  const activeStudents = students?.filter(s => s.status === 'student' && s.membership_status === 'active') || [];
  const totalActiveMembers = activeStudents.length;
  const trialMembers = students?.filter(s => s.status === 'trial').length || 0;
  
  // Calculate revenue
  let totalRevenue = 0;
  activeStudents.forEach(student => {
    const plan = plans?.find(p => p.id === student.membership_plan_id);
    if (plan) {
      totalRevenue += toAmount(plan.price);
    }
  });

  const averageValue = totalActiveMembers > 0 ? totalRevenue / totalActiveMembers : 0;

  // Calculate active members per plan
  const plansWithCounts = plans?.map(plan => {
    const activeCount = students?.filter(s => s.membership_plan_id === plan.id && s.membership_status === 'active').length || 0;
    const totalCount = students?.filter(s => s.membership_plan_id === plan.id).length || 0;
    return { ...plan, activeMembers: activeCount, totalMembers: totalCount };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Memberships</h2>
          <p className="text-muted-foreground">Manage membership plans and pricing</p>
        </div>
        {canManageBilling && (
          <Button onClick={handleAddPlan}>
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Revenue"
          value={formatMoney(totalRevenue)}
          icon={DollarSign}
          trend="+12.5%"
        />
        <StatCard
          title="Active Members"
          value={totalActiveMembers}
          icon={Users}
          trend="+8"
        />
        <StatCard
          title="Average Value"
          value={formatMoney(averageValue)}
          icon={TrendingUp}
        />
        <StatCard
          title="Trial Members"
          value={trialMembers}
          icon={Users}
          trend="+4"
        />
      </div>

      {/* Membership Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plansWithCounts?.map((plan) => (
          <Card
            key={plan.id}
            className="relative overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-200"
            onClick={() => navigate(`/membership/${plan.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>
                <Badge
                  variant={plan.status === "active" ? "default" : "secondary"}
                  className={cn(
                    plan.status === "active" && "bg-green-500 hover:bg-green-600",
                    plan.status === "inactive" && "bg-gray-500 hover:bg-gray-600"
                  )}
                >
                  {plan.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {formatPrice(plan.price, plan.currency)}
                  </span>
                  <span className="text-muted-foreground">/{formatPeriod(plan.period)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm mt-4">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    {plan.totalMembers} active members
                  </span>
                </div>

                <div className="space-y-2 pt-4 border-t border-border mt-4">
                  <p className="text-sm font-medium text-foreground">Features:</p>
                  <ul className="space-y-1.5">
                    {plan.features?.map((feature: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 mt-4">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/membership/${plan.id}`);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Students
                </Button>
                {!isFreePrice(plan.price) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateLink(plan);
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Copy Sign-up Link
                  </Button>
                )}
                {canManageBilling && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPlan(plan);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlan(plan);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MembershipDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedPlan}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <SignupLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        planName={linkPlanName}
        url={linkUrl}
        isLoading={false}
      />

      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {planToDelete?.totalMembers > 0 ? "Cannot Delete Plan" : "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {planToDelete?.totalMembers > 0 ? (
                <>
                  This plan is currently assigned to <span className="font-semibold">{planToDelete.totalMembers} students</span>.
                  You cannot delete a plan that is in use. Please reassign the students to a different plan first, or mark this plan as inactive.
                </>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete the
                  <span className="font-semibold"> {planToDelete?.name} </span>
                  membership plan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {(!planToDelete?.totalMembers || planToDelete.totalMembers === 0) && (
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
