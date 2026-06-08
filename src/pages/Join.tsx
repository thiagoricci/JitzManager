import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { formatMoney, formatPeriod } from "@/lib/money";
import { DEFAULT_WAIVER_TEXT } from "@/lib/waiver";

interface EnrollmentDetails {
  organizationName: string;
  plan: { name: string; description: string | null; price: string; period: string; currency?: string };
  waiverText: string | null;
}

type Step = "contact" | "waiver" | "submitting";

const STEPS = [
  { key: "contact", label: "Contact" },
  { key: "waiver", label: "Waiver" },
  { key: "submitting", label: "Payment" },
] as const;

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && "bg-primary/15 text-primary",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px w-8 mt-[-1.125rem]",
                  i < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Join() {
  const { organizationId, planId } = useParams();
  const [details, setDetails] = useState<EnrollmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("contact");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [consent, setConsent] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);

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

  const handleContactNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStep("waiver");
  };

  const waiverConsentValid = consent && (!isMinor || (!!guardianName.trim() && guardianConsent));

  const handleWaiverAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiverConsentValid || !organizationId || !planId) return;
    setStep("submitting");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-enrollment-checkout", {
        body: {
          organizationId,
          planId,
          name,
          email,
          phone,
          dateOfBirth: dateOfBirth || null,
          waiverSignedName: name.trim(),
          isMinor,
          guardianName: isMinor ? guardianName.trim() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Could not start checkout.");
      window.location.href = data.url as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setStep("waiver");
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
  const waiverText = details.waiverText || DEFAULT_WAIVER_TEXT;

  if (step === "submitting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 space-y-3">
            <StepIndicator current={step} />
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Redirecting to secure payment…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "waiver") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-1">
            <StepIndicator current={step} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("contact")}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            </div>
            <p className="text-sm font-medium text-primary">{details.organizationName}</p>
            <CardTitle className="text-2xl font-bold">Liability Waiver</CardTitle>
            <CardDescription>
              Please read the waiver below and sign to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Membership</span>
                <span className="text-lg font-semibold text-foreground">{priceLabel}</span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {waiverText}
            </div>

            <form onSubmit={handleWaiverAccept} className="space-y-5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(c) => setConsent(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug">
                  I have read, understand, and agree to this Waiver and Release of Liability, and I
                  voluntarily assume the risks of training.
                </Label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="isMinor"
                  checked={isMinor}
                  onCheckedChange={(c) => setIsMinor(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="isMinor" className="text-sm font-normal leading-snug">
                  The participant is under 18 years old.
                </Label>
              </div>

              {isMinor && (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Parent / Guardian</p>
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">Parent / guardian full name</Label>
                    <Input
                      id="guardianName"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent or legal guardian's full name"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="guardianConsent"
                      checked={guardianConsent}
                      onCheckedChange={(c) => setGuardianConsent(c === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="guardianConsent" className="text-sm font-normal leading-snug">
                      I am the parent or legal guardian of the participant and I agree to this Waiver
                      and Release of Liability on their behalf.
                    </Label>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting || !waiverConsentValid}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agree & Continue to payment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <StepIndicator current={step} />
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

          <form onSubmit={handleContactNext} className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Next: review and sign the liability waiver, then complete payment.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
