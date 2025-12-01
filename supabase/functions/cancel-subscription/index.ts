import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import Stripe from "https://esm.sh/stripe@12.3.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

if (!stripeSecretKey) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

const stripe = new Stripe(stripeSecretKey as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== CANCEL SUBSCRIPTION FUNCTION INVOKED ===");
    const { studentId, organizationId, reason } = await req.json();
    console.log("Request body:", { studentId, organizationId, reason });

    if (!studentId || !organizationId) {
      console.error("Missing required parameters.");
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Initializing Supabase client...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch student with Stripe customer ID
    console.log(`Fetching student with ID: ${studentId}`);
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, email, stripe_customer_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("Error fetching student:", studentError);
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Student found:", student);

    if (!student.stripe_customer_id) {
      console.log("Student has no Stripe customer ID, nothing to cancel");
      return new Response(
        JSON.stringify({ message: "No active subscription to cancel" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch organization with Stripe account ID
    console.log(`Fetching organization with ID: ${organizationId}`);
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", organizationId)
      .single();

    if (organizationError || !organization || !organization.stripe_account_id) {
      console.error("Error fetching organization:", organizationError);
      return new Response(
        JSON.stringify({ error: "Stripe account not configured for this organization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log("Organization found with Stripe account:", organization.stripe_account_id);

    // List all active subscriptions for this customer on the connected account
    console.log(`Listing subscriptions for customer: ${student.stripe_customer_id}`);
    const subscriptions = await stripe.subscriptions.list({
      customer: student.stripe_customer_id,
      status: "active",
    }, {
      stripeAccount: organization.stripe_account_id,
    });

    console.log(`Found ${subscriptions.data.length} active subscription(s)`);

    // Cancel all active subscriptions
    const cancelledSubscriptions = [];
    for (const subscription of subscriptions.data) {
      console.log(`Cancelling subscription: ${subscription.id}`);
      
      // Cancel immediately (not at period end) since the student is frozen/inactive
      const cancelledSub = await stripe.subscriptions.cancel(subscription.id, {
        cancellation_details: {
          comment: reason || "Student status changed to frozen/inactive",
        },
      }, {
        stripeAccount: organization.stripe_account_id,
      });
      
      cancelledSubscriptions.push({
        id: cancelledSub.id,
        status: cancelledSub.status,
      });
      console.log(`Subscription ${subscription.id} cancelled successfully`);
    }

    // Also check for any pending invoices and void them
    console.log("Checking for pending invoices...");
    const invoices = await stripe.invoices.list({
      customer: student.stripe_customer_id,
      status: "open",
    }, {
      stripeAccount: organization.stripe_account_id,
    });

    console.log(`Found ${invoices.data.length} open invoice(s)`);

    const voidedInvoices = [];
    for (const invoice of invoices.data) {
      console.log(`Voiding invoice: ${invoice.id}`);
      const voidedInvoice = await stripe.invoices.voidInvoice(invoice.id, {}, {
        stripeAccount: organization.stripe_account_id,
      });
      voidedInvoices.push({
        id: voidedInvoice.id,
        status: voidedInvoice.status,
      });
      console.log(`Invoice ${invoice.id} voided successfully`);
    }

    console.log("=== SUBSCRIPTION CANCELLATION COMPLETE ===");
    return new Response(
      JSON.stringify({
        success: true,
        cancelledSubscriptions,
        voidedInvoices,
        message: `Cancelled ${cancelledSubscriptions.length} subscription(s) and voided ${voidedInvoices.length} invoice(s)`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    
    let errorDetails: Record<string, any> = {};
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = { ...error as Record<string, any> };
    } else {
      errorDetails = { error: String(error) };
    }

    return new Response(
      JSON.stringify({
        error: "Error cancelling subscription",
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});