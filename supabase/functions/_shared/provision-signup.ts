import Stripe from "https://esm.sh/stripe@12.3.0";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { DEFAULT_WAIVER_TEXT } from "./waiver.ts";

export interface SelfSignupInput {
  organizationId: string;
  planId: string;
  connectedAccountId?: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  amountTotal: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth?: string | null;
  waiverSignedName?: string | null;
  waiverIsMinor?: boolean;
  waiverGuardianName?: string | null;
}

/**
 * Creates (or matches by email) a student from a completed self-signup checkout
 * and records the first payment. Idempotent on subscription_id: if the matched
 * student already carries this subscription, it returns early without inserting
 * a duplicate payment. Safe to call from both the redirect handler and the
 * Stripe webhook for the same checkout.
 */
export async function provisionSelfSignup(
  stripe: Stripe,
  supabase: SupabaseClient,
  input: SelfSignupInput,
): Promise<{ studentId: number; alreadyProvisioned: boolean }> {
  const { organizationId, planId, connectedAccountId, customerId, subscriptionId, amountTotal } = input;
  const name = input.name?.trim() || "New Student";
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const dateOfBirth = input.dateOfBirth?.trim() || null;

  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("price, period")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan not found");

  const isTrialPlan =
    parseFloat(plan.price) === 0 &&
    ["daily", "weekly"].includes((plan.period ?? "").toLowerCase());

  // Fetch the org's waiver text for snapshotting at signing time.
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("waiver_text")
    .eq("id", organizationId)
    .single();
  const waiverText = orgRow?.waiver_text?.trim() || DEFAULT_WAIVER_TEXT;

  const waiverSignedName = input.waiverSignedName?.trim() || name;
  const signedAt = new Date().toISOString();
  const waiverSignedDetails = {
    fullName: waiverSignedName,
    dateOfBirth: dateOfBirth || null,
    phone: phone,
    email: email,
    isMinor: !!input.waiverIsMinor,
    guardianName: input.waiverGuardianName?.trim() || null,
    signedAt,
  };

  // Match an existing student by email within the org to avoid duplicates.
  let existing: { id: number; subscription_id: string | null } | null = null;
  if (email) {
    const { data } = await supabase
      .from("students")
      .select("id, subscription_id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .maybeSingle();
    existing = data ?? null;
  }

  // Idempotency: this checkout was already provisioned (by the other handler).
  if (existing && subscriptionId && existing.subscription_id === subscriptionId) {
    return { studentId: existing.id, alreadyProvisioned: true };
  }

  const studentFields = {
    membership_status: "active",
    status: isTrialPlan ? "trial" : "student",
    membership_plan_id: parseInt(planId),
    stripe_customer_id: customerId,
    subscription_id: subscriptionId,
    waiver_status: "signed",
    waiver_signed_at: signedAt,
    waiver_signed_name: waiverSignedName,
    waiver_signed_text: waiverText,
    waiver_signed_details: waiverSignedDetails,
  };

  let studentId: number;
  if (existing) {
    const { error } = await supabase
      .from("students")
      .update({
        ...studentFields,
        name,
        ...(phone ? { phone } : {}),
        ...(dateOfBirth ? { birth_date: dateOfBirth } : {}),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    studentId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("students")
      .insert({
        organization_id: organizationId,
        name,
        email,
        phone,
        birth_date: dateOfBirth,
        belt: "white",
        stripes: 0,
        join_date: new Date().toISOString().split("T")[0],
        ...studentFields,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to create student");
    studentId = data.id;
  }

  // Back-fill studentId into the subscription metadata so recurring
  // invoice.paid / payment_failed events resolve the student.
  if (subscriptionId) {
    try {
      await stripe.subscriptions.update(
        subscriptionId,
        {
          metadata: {
            studentId: String(studentId),
            planId: String(planId),
            organizationId,
            sessionType: "student_self_signup",
          },
        },
        connectedAccountId ? { stripeAccount: connectedAccountId } : {},
      );
    } catch (metaErr) {
      console.error("Error back-filling subscription metadata:", metaErr);
    }
  }

  // Record the first payment (scheduled if the subscription starts in a trial window).
  const planPrice = parseFloat(plan.price);
  const charged = amountTotal ? amountTotal / 100 : 0;
  const isScheduled = charged === 0 && planPrice > 0;

  // Resolve the PaymentIntent so the payment is refundable. Scheduled charges
  // have no PaymentIntent yet — invoice.paid links it later via the webhook.
  let paymentIntentId: string | null = null;
  if (!isScheduled && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ["latest_invoice"] },
        connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
      );
      const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
      paymentIntentId = (latestInvoice?.payment_intent as string) || null;
    } catch (e) {
      console.error("Could not resolve PaymentIntent for self-signup:", e);
    }
  }

  const { error: payErr } = await supabase.from("payments").insert({
    student_id: studentId,
    organization_id: organizationId,
    amount: isScheduled ? planPrice : charged,
    date: new Date().toISOString(),
    status: isScheduled ? "scheduled" : "paid",
    stripe_payment_intent_id: paymentIntentId,
  });
  if (payErr) console.error("Error recording self-signup payment:", JSON.stringify(payErr));

  return { studentId, alreadyProvisioned: false };
}
