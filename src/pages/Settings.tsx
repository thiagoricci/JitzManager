import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, MapPin, Globe, Save, CreditCard, Link, Unlink, Loader2, ExternalLink, Lock, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getLocalTimezone } from "@/lib/date";

const settingsSchema = z.object({
  name: z.string().min(2, "Academy name must be at least 2 characters"),
  logo_url: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// Common timezones list
const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
];

export default function Settings() {
  const { organization, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      logo_url: "",
      address: "",
      timezone: "UTC",
    },
  });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        logo_url: organization.logo_url || "",
        address: organization.address || "",
        timezone: organization.timezone || "UTC",
      });
    }
  }, [organization, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    if (!organization) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: data.name,
          logo_url: data.logo_url || null,
          address: data.address || null,
          timezone: data.timezone,
        })
        .eq("id", organization.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Settings updated successfully");
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  const handleDetectTimezone = () => {
    const localTz = getLocalTimezone();
    form.setValue("timezone", localTz);
    toast.info(`Detected timezone: ${localTz}`);
  };

  if (!organization) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academy Settings</h1>
        <p className="text-muted-foreground">
          Manage your academy's profile and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            Update your academy's public information and location settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academy Name</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Gracie Barra Downtown" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Provide a direct link to your academy's logo image.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <Input placeholder="123 Main St, City, State" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <div className="flex-1 flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {timezones.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz}
                                </SelectItem>
                              ))}
                              {!timezones.includes(field.value) && field.value && (
                                <SelectItem value={field.value}>
                                  {field.value}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDetectTimezone}
                      >
                        Detect
                      </Button>
                    </div>
                    <FormDescription>
                      This will be used to display dates and times correctly for your
                      location.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>


      <AccountSettingsCard />
      <StripeConnectCard />
      <DangerZoneCard />
    </div>
  );
}

function DangerZoneCard() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Account deleted successfully");
      await signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions for your account and organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div>
              <h3 className="font-semibold text-destructive">
                Delete Account
              </h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account, organization, and all related data.
              </p>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your
                  account, organization, students, memberships, and remove your
                  data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountSettingsCard() {
  const { user } = useAuth();
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().email("Invalid email address") })),
    defaultValues: {
      email: user?.email || "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(
      z.object({
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string(),
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
    ),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onUpdateEmail = async (data: { email: string }) => {
    setLoadingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: data.email });
      if (error) throw error;
      toast.success("Check your email to confirm the change");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingEmail(false);
    }
  };

  const onUpdatePassword = async (data: any) => {
    setLoadingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      toast.success("Password updated successfully");
      passwordForm.reset();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Security</CardTitle>
        <CardDescription>
          Update your email address and password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onUpdateEmail)} className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <div className="flex-1 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="email" />
                      </div>
                    </FormControl>
                    <Button type="submit" disabled={loadingEmail}>
                      {loadingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Email"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Change Password
            </span>
          </div>
        </div>

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input {...field} type="password" placeholder="New password" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input {...field} type="password" placeholder="Confirm new password" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingPassword}>
                {loadingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function StripeConnectCard() {
  const { organization, session, refreshProfile } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!organization?.stripe_account_id;

  const handleConnectStripe = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }

    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-stripe-connect-link",
        {
          body: JSON.stringify({
            returnUrl: `${window.location.origin}/stripe-connect-callback`,
          }),
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to create Stripe link");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Error connecting Stripe:", err);
      toast.error(err instanceof Error ? err.message : "Failed to connect Stripe");
      setConnecting(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }

    if (!confirm("Are you sure you want to disconnect your Stripe account? You will no longer be able to accept payments until you reconnect.")) {
      return;
    }

    setDisconnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "disconnect-stripe-account",
        {
          body: {},
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to disconnect Stripe");
      }

      await refreshProfile();
      toast.success("Stripe account disconnected");
    } catch (err: unknown) {
      console.error("Error disconnecting Stripe:", err);
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Stripe");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Integration</CardTitle>
        <CardDescription>
          Connect your existing Stripe account to accept payments from students. You must already have a Stripe account to connect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/20 p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-600">
                    Stripe Connected
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your academy is ready to accept payments.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Stripe Dashboard
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnectStripe}
                disabled={disconnecting}
                className="flex-1"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect Stripe
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-yellow-600" />
                <div>
                  <h3 className="font-semibold text-yellow-600">
                    Stripe Not Connected
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Log in to your existing Stripe account to start accepting payments.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleConnectStripe}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect Existing Stripe Account
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to log in to your <strong>existing Stripe account</strong>.
              Don't have a Stripe account? <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Create one first</a>, then return here to connect it.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}