import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface WaiverDetails {
  studentName: string;
  studentEmail: string | null;
  studentPhone: string | null;
  studentDateOfBirth: string | null;
  organizationName: string;
  waiverText: string;
  alreadySigned: boolean;
  signedAt: string | null;
}

interface WaiverSignFormProps {
  token: string;
  /** Called after a successful signature (e.g. to refresh staff-facing data). */
  onSigned?: () => void;
}

/**
 * Self-contained waiver loading + signing experience. Used both on the public
 * /waiver page (student opens an emailed link) and inside an in-app dialog
 * (staff hands their device to the student to sign on the spot).
 */
export default function WaiverSignForm({ token, onSigned }: WaiverSignFormProps) {
  const [details, setDetails] = useState<WaiverDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("This waiver link is invalid.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("get-waiver", {
          body: { token },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const d = data as WaiverDetails;
        setDetails(d);
        setFullName(d.studentName || "");
        setEmail(d.studentEmail || "");
        setPhone(d.studentPhone || "");
        setDateOfBirth(d.studentDateOfBirth || "");
        if (d.alreadySigned) setSigned(true);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load this waiver.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const canSubmit =
    !!fullName.trim() &&
    consent &&
    (!isMinor || (!!guardianName.trim() && guardianConsent));

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-waiver", {
        body: {
          token,
          fullName: fullName.trim(),
          dateOfBirth: dateOfBirth || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          isMinor,
          guardianName: isMinor ? guardianName.trim() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSigned(true);
      onSigned?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !details) {
    return (
      <div className="py-8 text-center">
        <h3 className="text-lg font-semibold">Waiver unavailable</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {loadError || "This waiver link is invalid."}
        </p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold">Waiver signed</h3>
        <p className="text-sm text-muted-foreground">
          Thank you. The waiver for {details.organizationName} has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">{details.organizationName}</p>
        <h3 className="text-xl font-bold">Liability Waiver</h3>
        <p className="text-sm text-muted-foreground">
          Please read the waiver below, fill in your details, and sign to complete registration.
        </p>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {details.waiverText}
      </div>

      <form onSubmit={handleSign} className="space-y-5">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">Participant Information</p>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full legal name"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>
        </div>

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

        <Button type="submit" className="w-full" disabled={submitting || !canSubmit}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign Waiver
        </Button>
      </form>
    </div>
  );
}
