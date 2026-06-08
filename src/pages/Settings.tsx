import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, MapPin, Globe, Save, CreditCard, Link, Unlink, Loader2, ExternalLink, AlertTriangle, FileText } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getLocalTimezone } from "@/lib/date";
import AppearanceCard from "@/components/AppearanceCard";
import LogoUpload from "@/components/LogoUpload";
import StaffManagementCard from "@/components/StaffManagementCard";
import AuditLogCard from "@/components/AuditLogCard";
import DunningSettingsCard from "@/components/DunningSettingsCard";

const settingsSchema = z.object({
  name: z.string().min(2, "Academy name must be at least 2 characters"),
  logo_url: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

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
  const [activeTab, setActiveTab] = useState("general");

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
    } catch (error) {
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your academy's profile, payments, and preferences.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="md:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="appearance">Appearance</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
              <SelectItem value="waiver">Waiver</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="audit">Audit Log</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden md:flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="waiver">Waiver</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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
                        <FormLabel>Academy Logo</FormLabel>
                        <FormControl>
                          <LogoUpload
                            value={field.value || null}
                            onChange={(url) => field.onChange(url || "")}
                            organizationId={organization.id}
                          />
                        </FormControl>
                        <FormDescription>
                          This logo appears in the sidebar and on student-facing pages.
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

          <DangerZoneCard />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceCard />
        </TabsContent>

        <TabsContent value="payments">
          <StripeConnectCard />
        </TabsContent>

        <TabsContent value="waiver">
          <WaiverCard />
        </TabsContent>

        <TabsContent value="staff">
          <StaffManagementCard />
        </TabsContent>

        <TabsContent value="billing">
          <DunningSettingsCard />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WaiverCard() {
  const { organization, refreshProfile } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) setText(organization.waiver_text || "");
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ waiver_text: text.trim() || null })
        .eq("id", organization.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Waiver text saved");
    } catch (error) {
      console.error("Error saving waiver text:", error);
      toast.error("Failed to save waiver text");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Liability Waiver
        </CardTitle>
        <CardDescription>
          The waiver students read and sign through their waiver link. Leave blank to use a
          standard default waiver.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your academy's waiver / liability wording here..."
        />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Waiver
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
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
    } catch (error) {
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

function StripeConnectCard() {
  const { organization, session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!organization?.stripe_account_id;
  const isReady = !!organization?.stripe_charges_enabled;

  const openConnectLink = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-stripe-connect-link",
        {
          body: { returnUrl: `${window.location.origin}/stripe-connect-callback` },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (error) {
        let message = error.message || "Failed to create Stripe link";
        try {
          const body = await (error as { context?: Response }).context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // ignore JSON parse failure
        }
        throw new Error(message);
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error("Error connecting Stripe:", err);
      toast.error(err instanceof Error ? err.message : "Failed to connect Stripe");
      setLoading(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "disconnect-stripe-account",
        { body: {}, headers: { Authorization: `Bearer ${session.access_token}` } }
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
          Connect your Stripe account to collect membership payments from students.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {!isConnected && (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <CreditCard className="h-6 w-6 shrink-0 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-700">Not Connected</h3>
                <p className="text-sm text-muted-foreground">
                  You need to connect a Stripe account before you can charge students.
                </p>
              </div>
            </div>
            <Button onClick={openConnectLink} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}
              {loading ? "Redirecting…" : "Connect Stripe Account"}
            </Button>
          </>
        )}

        {isConnected && !isReady && (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-orange-500/50 bg-orange-50 dark:bg-orange-950/20 p-4">
              <Loader2 className="h-6 w-6 shrink-0 text-orange-500" />
              <div>
                <h3 className="font-semibold text-orange-700">Setup Incomplete</h3>
                <p className="text-sm text-muted-foreground">
                  Your Stripe account is connected but hasn't finished onboarding. Complete the setup to start accepting payments.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={openConnectLink} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                {loading ? "Redirecting…" : "Complete Stripe Setup"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={disconnecting} className="flex-1">
                    {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Stripe Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the Stripe account link. You can reconnect at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnectStripe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {isConnected && isReady && (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/20 p-4">
              <CreditCard className="h-6 w-6 shrink-0 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-700">Stripe Connected</h3>
                <p className="text-sm text-muted-foreground">
                  Your academy is verified and ready to accept student payments.
                </p>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={disconnecting} className="flex-1">
                    {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                    {disconnecting ? "Disconnecting…" : "Disconnect Stripe"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Stripe Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will no longer be able to charge students until you reconnect a Stripe account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnectStripe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
