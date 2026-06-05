import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Parse "1, 3, 5, 7" into a sorted, de-duplicated list of positive day offsets.
function parseRetryDays(input: string): number[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).sort((a, b) => a - b);
}

export default function DunningSettingsCard() {
  const { organization, refreshProfile, can } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [freezeOnFinal, setFreezeOnFinal] = useState(true);
  const [retryDays, setRetryDays] = useState("1, 3, 5, 7");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setEnabled(organization.dunning_enabled ?? true);
      setFreezeOnFinal(organization.dunning_freeze_on_final ?? true);
      setRetryDays((organization.dunning_retry_days ?? [1, 3, 5, 7]).join(", "));
    }
  }, [organization]);

  if (!can("manage_billing")) return null;

  const parsedDays = parseRetryDays(retryDays);
  const daysValid = parsedDays.length > 0;

  const handleSave = async () => {
    if (!organization) return;
    if (!daysValid) {
      toast.error("Enter at least one positive retry day (e.g. 1, 3, 5, 7).");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        dunning_enabled: enabled,
        dunning_freeze_on_final: freezeOnFinal,
        dunning_retry_days: parsedDays,
      })
      .eq("id", organization.id);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    toast.success("Dunning settings saved.");
    await refreshProfile(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Automated Dunning
        </CardTitle>
        <CardDescription>
          Automatically retry failed membership payments on a schedule, email the member,
          and pause the membership after the final attempt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dunning-enabled">Enable automated dunning</Label>
            <p className="text-sm text-muted-foreground">
              When off, failed payments are only retried manually from Past Due.
            </p>
          </div>
          <Switch id="dunning-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="retry-days">Retry schedule (days after first failure)</Label>
          <Input
            id="retry-days"
            value={retryDays}
            onChange={(e) => setRetryDays(e.target.value)}
            placeholder="1, 3, 5, 7"
            disabled={!enabled}
          />
          {daysValid ? (
            <p className="text-sm text-muted-foreground">
              Retries on day {parsedDays.join(", ")} — the last is the final attempt.
            </p>
          ) : (
            <p className="text-sm text-destructive">
              Enter a comma-separated list of positive days, e.g. 1, 3, 5, 7.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="freeze-on-final">Freeze membership after final attempt</Label>
            <p className="text-sm text-muted-foreground">
              Sets the member to frozen when the last retry fails (grace policy).
            </p>
          </div>
          <Switch
            id="freeze-on-final"
            checked={freezeOnFinal}
            onCheckedChange={setFreezeOnFinal}
            disabled={!enabled}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !daysValid}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
