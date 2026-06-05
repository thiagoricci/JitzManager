// Automated dunning runner (issue #7).
//
// Invoked once a day by pg_cron (see migration 20260605000001_dunning_cron.sql).
// For every org with dunning enabled it:
//   1. Seeds a dunning_attempts schedule for newly failed payments.
//   2. Runs at most one due attempt per payment (throttled to one charge/day):
//        - success  → mark payment paid, reactivate student, skip the rest.
//        - failure  → email the member; on the final attempt, freeze membership.
//
// Charging reuses the shared attemptCharge helper (same logic as manual retry).
// Auth: the cron job sends the service-role key; anything else is rejected.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";
import { recordAudit } from "../_shared/audit.ts";
import { attemptCharge } from "../_shared/charge.ts";
import {
  finalNoticeEmail,
  membershipFrozenEmail,
  paymentFailedEmail,
  sendEmail,
} from "../_shared/email.ts";
import { computeAttemptDates, toDateString } from "../_shared/dunning-schedule.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Don't resurrect ancient failures when first enabling dunning.
const SEED_LOOKBACK_DAYS = 60;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
  const today = toDateString(new Date());
  const nowIso = new Date().toISOString();

  const summary = { orgs: 0, seeded: 0, recovered: 0, failed: 0, frozen: 0, skipped: 0 };

  try {
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, stripe_account_id, dunning_retry_days, dunning_freeze_on_final")
      .eq("dunning_enabled", true);
    if (orgsError) throw orgsError;

    for (const org of orgs ?? []) {
      if (!org.stripe_account_id) continue; // can't charge without a connected account
      summary.orgs++;

      // --- 1. Seed schedules for newly failed payments ----------------------
      const lookback = new Date(Date.now() - SEED_LOOKBACK_DAYS * 86400000)
        .toISOString()
        .slice(0, 10);

      const { data: failedPayments } = await supabase
        .from("payments")
        .select("id, amount, student_id, organization_id, stripe_invoice_id, date")
        .eq("organization_id", org.id)
        .eq("status", "failed")
        .gte("date", lookback);

      const { data: existingAttempts } = await supabase
        .from("dunning_attempts")
        .select("payment_id")
        .eq("organization_id", org.id);
      const alreadySeeded = new Set((existingAttempts ?? []).map((a) => a.payment_id));

      for (const payment of failedPayments ?? []) {
        if (alreadySeeded.has(payment.id)) continue;
        const planned = computeAttemptDates(payment.date, org.dunning_retry_days ?? []);
        if (planned.length === 0) continue;
        const rows = planned.map((p) => ({
          organization_id: org.id,
          payment_id: payment.id,
          student_id: payment.student_id,
          attempt_number: p.attemptNumber,
          scheduled_for: p.scheduledFor,
          is_final: p.isFinal,
        }));
        const { error: seedErr } = await supabase.from("dunning_attempts").insert(rows);
        if (seedErr) {
          console.error(`Seed failed for payment ${payment.id}:`, seedErr.message);
          continue;
        }
        summary.seeded++;
      }

      // --- 2. Run due attempts (one per payment this run) -------------------
      const { data: dueAttempts } = await supabase
        .from("dunning_attempts")
        .select(
          "*, payments(id, amount, student_id, organization_id, stripe_invoice_id, status), students(name, email, stripe_customer_id, subscription_id)",
        )
        .eq("organization_id", org.id)
        .eq("status", "pending")
        .lte("scheduled_for", today)
        .order("attempt_number", { ascending: true });

      // Throttle: only the earliest pending attempt per payment runs per day.
      const seenPayment = new Set<number>();
      for (const attempt of dueAttempts ?? []) {
        if (seenPayment.has(attempt.payment_id)) continue;
        seenPayment.add(attempt.payment_id);

        const payment = attempt.payments;
        const student = attempt.students;

        // Payment already resolved (paid/refunded) — drop the rest of its schedule.
        if (!payment || payment.status !== "failed") {
          await supabase
            .from("dunning_attempts")
            .update({ status: "skipped", outcome: "payment no longer failed", processed_at: nowIso })
            .eq("payment_id", attempt.payment_id)
            .eq("status", "pending");
          summary.skipped++;
          continue;
        }

        const result = await attemptCharge(
          stripe,
          {
            id: payment.id,
            amount: Number(payment.amount),
            student_id: payment.student_id,
            organization_id: payment.organization_id,
            stripe_invoice_id: payment.stripe_invoice_id,
          },
          {
            stripe_customer_id: student?.stripe_customer_id ?? null,
            subscription_id: student?.subscription_id ?? null,
          },
          org.stripe_account_id,
        );

        const studentName = student?.name ?? "student";
        const amount = Number(payment.amount);

        if (result.succeeded) {
          await supabase
            .from("payments")
            .update({ status: "paid", failure_reason: null, failure_code: null, next_retry_at: null })
            .eq("id", payment.id);
          await supabase
            .from("students")
            .update({ membership_status: "active", status: "student" })
            .eq("id", payment.student_id);
          await supabase
            .from("dunning_attempts")
            .update({ status: "succeeded", outcome: "payment recovered", processed_at: nowIso })
            .eq("id", attempt.id);
          // Cancel the remaining schedule for this payment.
          await supabase
            .from("dunning_attempts")
            .update({ status: "skipped", outcome: "payment recovered", processed_at: nowIso })
            .eq("payment_id", payment.id)
            .eq("status", "pending");

          await recordAudit(supabase, {
            organizationId: org.id,
            actorId: null,
            action: "payment.dunning_recovered",
            entityType: "payment",
            entityId: payment.id,
            summary: `Dunning recovered payment #${payment.id} for ${studentName} ($${amount.toFixed(2)})`,
            details: { amount, student_id: payment.student_id, attempt_number: attempt.attempt_number },
          });
          summary.recovered++;
          continue;
        }

        // Failure: record it on the payment + attempt.
        await supabase
          .from("payments")
          .update({
            retry_count: (attempt.attempt_number ?? 0),
            failure_reason: result.failureReason,
            failure_code: result.failureCode,
          })
          .eq("id", payment.id);
        await supabase
          .from("dunning_attempts")
          .update({ status: "failed", outcome: result.failureReason, processed_at: nowIso })
          .eq("id", attempt.id);
        summary.failed++;

        if (attempt.is_final && org.dunning_freeze_on_final) {
          // Final attempt failed → freeze the membership.
          await supabase
            .from("students")
            .update({
              membership_status: "frozen",
              frozen_at: nowIso,
              freeze_reason: "Payment failed after final retry attempt",
            })
            .eq("id", payment.student_id);

          if (student?.email) {
            await sendEmail({ ...membershipFrozenEmail(org.name, studentName, amount), to: student.email });
          }
          await supabase
            .from("dunning_attempts")
            .update({ notified_at: nowIso })
            .eq("id", attempt.id);

          await recordAudit(supabase, {
            organizationId: org.id,
            actorId: null,
            action: "membership.frozen",
            entityType: "student",
            entityId: payment.student_id,
            summary: `Froze ${studentName}'s membership after final failed payment ($${amount.toFixed(2)})`,
            details: { amount, payment_id: payment.id },
          });
          summary.frozen++;
          continue;
        }

        // Not final → notify the member; warn harder if the next attempt is the last.
        const { data: nextAttempt } = await supabase
          .from("dunning_attempts")
          .select("scheduled_for, is_final")
          .eq("payment_id", payment.id)
          .eq("status", "pending")
          .gt("attempt_number", attempt.attempt_number)
          .order("attempt_number", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (student?.email && nextAttempt) {
          const msg = nextAttempt.is_final
            ? finalNoticeEmail(org.name, studentName, amount, nextAttempt.scheduled_for)
            : paymentFailedEmail(org.name, studentName, amount, nextAttempt.scheduled_for);
          await sendEmail({ ...msg, to: student.email });
          await supabase.from("dunning_attempts").update({ notified_at: nowIso }).eq("id", attempt.id);
        }

        await recordAudit(supabase, {
          organizationId: org.id,
          actorId: null,
          action: "payment.dunning_retry",
          entityType: "payment",
          entityId: payment.id,
          summary: `Dunning retry failed for payment #${payment.id} (${studentName}): ${result.failureReason}`,
          details: {
            amount,
            student_id: payment.student_id,
            attempt_number: attempt.attempt_number,
            failure_code: result.failureCode,
          },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-dunning error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
