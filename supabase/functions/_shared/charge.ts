// Shared Stripe charge routine for retrying a failed payment.
//
// Both the manual "Retry now" action (retry-payment) and the automated dunning
// runner (process-dunning) need the same recovery logic, so it lives here.
//
// It tries three strategies in order, stopping at the first success:
//   1. Pay the specific invoice we stored on the failed payment.
//   2. If there's no stored invoice but the student has a subscription, pay the
//      subscription's latest open invoice.
//   3. Otherwise charge the saved default card directly via a PaymentIntent.
//
// It never throws: every failure is captured into { failureReason, failureCode }
// so callers can record it.

import Stripe from "https://esm.sh/stripe@12.3.0";

export interface ChargePayment {
  id: number;
  amount: number;
  student_id: number | null;
  organization_id: string;
  stripe_invoice_id: string | null;
}

export interface ChargeStudent {
  stripe_customer_id: string | null;
  subscription_id: string | null;
}

export interface ChargeResult {
  succeeded: boolean;
  failureReason: string;
  failureCode: string | null;
}

export async function attemptCharge(
  stripe: Stripe,
  payment: ChargePayment,
  student: ChargeStudent,
  stripeAccountId: string,
): Promise<ChargeResult> {
  const stripeOptions = { stripeAccount: stripeAccountId };
  let chargeSucceeded = false;
  let failureReason = "Payment failed";
  let failureCode: string | null = null;

  // Attempt 1: pay the specific invoice we stored
  const invoiceId = payment.stripe_invoice_id;
  if (invoiceId) {
    try {
      const paid = await stripe.invoices.pay(invoiceId, { forgive: true }, stripeOptions);
      chargeSucceeded = paid.status === "paid";
      if (!chargeSucceeded) {
        const chargeId = paid.charge as string;
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId, {}, stripeOptions);
          failureCode = charge.failure_code ?? null;
          failureReason = charge.failure_message || failureReason;
        }
      }
    } catch (err: any) {
      console.error("Invoice pay error:", err);
      failureReason = err?.message || failureReason;
      failureCode = err?.raw?.decline_code || err?.raw?.code || null;
    }
  }

  // Attempt 2: if no stored invoice but subscription exists, pay its latest open invoice
  if (!chargeSucceeded && !invoiceId && student.subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(student.subscription_id, stripeOptions);
      const latestInvoiceId = sub.latest_invoice as string;
      if (latestInvoiceId) {
        const paid = await stripe.invoices.pay(latestInvoiceId, { forgive: true }, stripeOptions);
        chargeSucceeded = paid.status === "paid";
        if (!chargeSucceeded) {
          const chargeId = paid.charge as string;
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId, {}, stripeOptions);
            failureCode = charge.failure_code ?? null;
            failureReason = charge.failure_message || failureReason;
          }
        }
      }
    } catch (err: any) {
      console.error("Subscription invoice pay error:", err);
      failureReason = err?.message || failureReason;
      failureCode = err?.raw?.decline_code || err?.raw?.code || null;
    }
  }

  // Attempt 3: fall back to a direct PaymentIntent with the saved default card
  if (!chargeSucceeded && !invoiceId && !student.subscription_id) {
    try {
      const customer = await stripe.customers.retrieve(
        student.stripe_customer_id as string,
        {},
        stripeOptions,
      ) as Stripe.Customer;

      const defaultPmId = customer.invoice_settings?.default_payment_method as string | null;
      if (!defaultPmId) {
        return {
          succeeded: false,
          failureReason: "No default payment method on file",
          failureCode: "no_payment_method",
        };
      }

      const pi = await stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100),
        currency: "usd",
        customer: student.stripe_customer_id as string,
        payment_method: defaultPmId,
        confirm: true,
        off_session: true,
        metadata: {
          studentId: payment.student_id?.toString() ?? "",
          organizationId: payment.organization_id,
        },
      }, stripeOptions);

      chargeSucceeded = pi.status === "succeeded";
      if (!chargeSucceeded) {
        failureCode = pi.last_payment_error?.code ?? null;
        failureReason = pi.last_payment_error?.message || failureReason;
      }
    } catch (err: any) {
      console.error("PaymentIntent error:", err);
      failureReason = err?.message || failureReason;
      failureCode = err?.raw?.decline_code || err?.raw?.code || null;
    }
  }

  return { succeeded: chargeSucceeded, failureReason, failureCode };
}
