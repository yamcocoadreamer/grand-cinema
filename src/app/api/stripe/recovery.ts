
import "server-only";

import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inspectStripeCheckout(
  paymentId: string
) {
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, status, stripe_checkout_session_id, checkout_creation_token"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    throw new Error("Paiement introuvable.");
  }

  if (payment.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      payment.stripe_checkout_session_id
    );

    return {
      state: "session_found",
      sessionId: session.id,
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
    };
  }

  if (payment.checkout_creation_token) {
    return {
      state: "creation_interrupted",
      paymentId: payment.id,
    };
  }

  return {
    state: "no_session",
    paymentId: payment.id,
  };
}
