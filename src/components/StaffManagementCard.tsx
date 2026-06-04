import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ASSIGNABLE_ROLES, ROLE_LABELS, roleLabel } from "@/lib/permissions";
import { toast } from "sonner";

type StaffMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

const staffSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "coach", "front_desk"]),
});

type StaffFormValues = z.infer<typeof staffSchema>;

// Surface the real error message from a Supabase edge function invocation.
async function extractInvokeError(error: unknown, fallback: string): Promise<string> {
  let message = (error as { message?: string })?.message || fallback;
  try {
    const body = await (error as { context?: Response }).context?.json?.();
    if (body?.error) message = body.error;
  } catch {
    // ignore JSON parse failure
  }
  return message;
}

export default function StaffManagementCard() {
  const { organization, session, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { full_name: "", email: "", password: "", role: "coach" },
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("organization_id", organization!.id)
        .neq("role", "owner")
        .neq("id", user?.id ?? "")
        .order("full_name", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const onChangeRole = async (userId: string, role: string) => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }
    setUpdatingRoleId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("update-staff-role", {
        body: { userId, role },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(await extractInvokeError(error, "Failed to update role"));
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ["staff", organization?.id] });
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const onAddStaff = async (values: StaffFormValues) => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: values,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(await extractInvokeError(error, "Failed to add staff member"));
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ["staff", organization?.id] });
      toast.success("Staff member added");
      form.reset();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveStaff = async (userId: string) => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }
    setRemovingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-staff", {
        body: { userId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw new Error(await extractInvokeError(error, "Failed to remove staff member"));
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ["staff", organization?.id] });
      toast.success("Staff member removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove staff member");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>
            Each member's role controls what they can do. Admins have full access;
            front desk manages students and attendance; coaches record attendance and
            promote ranks. Members manage their own login from their Profile page.
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Create an account for a staff member. They can change their password later
                from their Profile page.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddStaff)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="At least 6 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Staff Member"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            <Users className="h-6 w-6" />
            <p className="text-sm">No staff members yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.full_name || "Unnamed staff"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(value) => onChangeRole(member.id, value)}
                    disabled={updatingRoleId === member.id}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue placeholder={roleLabel(member.role)} />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={removingId === member.id}
                    >
                      {removingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes {member.full_name || member.email}'s account.
                        They will no longer be able to log in. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRemoveStaff(member.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
