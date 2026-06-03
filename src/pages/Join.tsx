import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { formatMoney, formatPeriod } from "@/lib/money";

interface EnrollmentDetails {
  organizationName: string;
  plan: { name: string; description: string | null; price: string; period: string; currency?: string };
}

export default function Join() {
  const { organizationId, planId } = useParams();
  const [details, setDetails] = useState<EnrollmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!organizationId || !planId) {
        setLoadError("This sign-up link is invalid.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("get-enrollment-details", {
          body: { organizationId, planId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setDetails(data as EnrollmentDetails);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load this sign-up link.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organizationId, planId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !planId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-enrollment-checkout", {
        body: { organizationId, planId, name, email, phone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Could not start checkout.");
      window.location.href = data.url as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-xl">Sign-up unavailable</CardTitle>
            <CardDescription>{loadError || "This sign-up link is invalid."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const priceLabel = `${formatMoney(details.plan.price, details.plan.currency)} / ${formatPeriod(details.plan.period).toLowerCase()}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <p className="text-sm font-medium text-primary">{details.organizationName}</p>
          <CardTitle className="text-2xl font-bold">Join {details.plan.name}</CardTitle>
          <CardDescription>
            {details.plan.description || "Enter your details to sign up and pay securely."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Membership</span>
              <span className="text-lg font-semibold text-foreground">{priceLabel}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to payment
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You'll be redirected to Stripe to complete your payment securely.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
