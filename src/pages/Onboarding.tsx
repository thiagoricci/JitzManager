import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      // 1. Check for existing organization
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      let orgId;

      if (existingOrg) {
        // Update existing organization
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .update({ name: orgName, slug })
          .eq("id", existingOrg.id)
          .select()
          .single();

        if (orgError) throw orgError;
        orgId = org.id;
      } else {
        // Create new organization
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert([{ name: orgName, slug, owner_id: user.id }])
          .select()
          .single();

        if (orgError) throw orgError;
        orgId = org.id;
      }

      // 2. Create or Update Profile linked to Organization
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        organization_id: orgId,
        role: "owner",
      });

      if (profileError) throw profileError;

      toast.success("Organization created successfully!");
      
      // 3. Wait for profile refresh to complete before redirecting
      await refreshProfile();
      
      // Small delay to ensure the auth context has updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Only redirect if we have successfully loaded the organization data
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Error creating organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to Academy Manager</CardTitle>
          <CardDescription>
            Let's set up your academy. What is the name of your gym?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Academy Name</Label>
              <Input
                id="orgName"
                placeholder="e.g. Gracie Barra Downtown"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up..." : "Get Started"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}