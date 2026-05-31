import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_WAIVER_TEXT } from "../_shared/waiver.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Public: records a student's signed waiver, including the participant details
// and (for minors) the guardian, snapshotting both the text and the submission.
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      token?: string;
      fullName?: string;
      dateOfBirth?: string;
      phone?: string;
      email?: string;
      isMinor?: boolean;
      guardianName?: string;
    };

    const { token, dateOfBirth, phone, email, isMinor } = body;
    const fullName = body.fullName?.trim();
    const guardianName = body.guardianName?.trim() || null;

    if (!token) return json({ error: "Missing token" }, 400);
    if (!fullName) return json({ error: "Please type the participant's full name to sign." }, 400);
    if (isMinor && !guardianName) {
      return json({ error: "A parent/guardian name is required for participants under 18." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: student, error } = await supabase
      .from("students")
      .select("id, waiver_status, organizations(waiver_text)")
      .eq("waiver_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!student) return json({ error: "This waiver link is invalid." }, 404);

    if (student.waiver_status === "signed") {
      return json({ alreadySigned: true });
    }

    const org = student.organizations as { waiver_text: string | null };
    const signedText = org?.waiver_text?.trim() || DEFAULT_WAIVER_TEXT;
    const signedAt = new Date().toISOString();

    const signedDetails = {
      fullName,
      dateOfBirth: dateOfBirth || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      isMinor: !!isMinor,
      guardianName,
      signedAt,
    };

    const { error: updateError } = await supabase
      .from("students")
      .update({
        waiver_status: "signed",
        waiver_signed_at: signedAt,
        waiver_signed_name: fullName,
        waiver_signed_text: signedText,
        waiver_signed_details: signedDetails,
        // Flow the submitted participant info back to the live student record.
        name: fullName,
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
        ...(dateOfBirth ? { birth_date: dateOfBirth } : {}),
      })
      .eq("id", student.id);

    if (updateError) return json({ error: updateError.message }, 500);

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error signing waiver:", message);
    return json({ error: message }, 500);
  }
});
