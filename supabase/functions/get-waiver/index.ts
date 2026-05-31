import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_WAIVER_TEXT } from "../_shared/waiver.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Public: resolves a waiver token to the info needed to render the signing page.
// Only returns the student's name (no email/phone) to limit what a token exposes.
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json() as { token?: string };
    if (!token) return json({ error: "Missing token" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: student, error } = await supabase
      .from("students")
      .select("name, email, phone, birth_date, waiver_status, waiver_signed_at, organizations(name, waiver_text)")
      .eq("waiver_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!student) return json({ error: "This waiver link is invalid." }, 404);

    const org = student.organizations as { name: string; waiver_text: string | null };

    return json({
      studentName: student.name,
      // The token is the student's own personal link, so pre-filling their own
      // contact details is acceptable and reduces friction.
      studentEmail: student.email,
      studentPhone: student.phone,
      studentDateOfBirth: student.birth_date,
      organizationName: org?.name ?? "",
      waiverText: org?.waiver_text?.trim() || DEFAULT_WAIVER_TEXT,
      alreadySigned: student.waiver_status === "signed",
      signedAt: student.waiver_signed_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error fetching waiver:", message);
    return json({ error: message }, 500);
  }
});
